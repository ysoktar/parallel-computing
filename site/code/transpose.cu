// Page 6.7: NVIDIA's transpose series (M. Harris): copy (the speed to aim for), naive, coalesced through a shared tile,
// and the padded tile without bank conflicts. TILE_DIM = 32, BLOCK_ROWS = 8: blocks of 32×8 threads, so each thread
// handles 4 elements of a 32×32 tile (rows y, y+8, y+16, y+24). Effective bandwidth = 2 × matrix size / time.
#include <cstdio>
#include <cstdlib>
#include <vector>

const int TILE_DIM = 32;
const int BLOCK_ROWS = 8;

__global__ void copy(float* odata, const float* idata)
{
    int x = blockIdx.x * TILE_DIM + threadIdx.x;
    int y = blockIdx.y * TILE_DIM + threadIdx.y;   // with TILE_DIM, not blockDim.y!
    int width = gridDim.x * TILE_DIM;
    for (int j = 0; j < TILE_DIM; j += BLOCK_ROWS)
        odata[(y + j) * width + x] = idata[(y + j) * width + x];
}

__global__ void transposeNaive(float* odata, const float* idata)
{
    int x = blockIdx.x * TILE_DIM + threadIdx.x;
    int y = blockIdx.y * TILE_DIM + threadIdx.y;
    int width = gridDim.x * TILE_DIM;
    for (int j = 0; j < TILE_DIM; j += BLOCK_ROWS)
        odata[x * width + (y + j)] = idata[(y + j) * width + x];   // the write is 'width' elements apart per thread
}

__global__ void transposeCoalesced(float* odata, const float* idata)
{
    __shared__ float tile[TILE_DIM][TILE_DIM];

    int x = blockIdx.x * TILE_DIM + threadIdx.x;
    int y = blockIdx.y * TILE_DIM + threadIdx.y;
    int width = gridDim.x * TILE_DIM;

    for (int j = 0; j < TILE_DIM; j += BLOCK_ROWS)
        tile[threadIdx.y + j][threadIdx.x] = idata[(y + j) * width + x];   // coalesced read

    __syncthreads();   // threads will write DIFFERENT elements than they read: the tile must be full

    x = blockIdx.y * TILE_DIM + threadIdx.x;   // transposed block position: bx ↔ by
    y = blockIdx.x * TILE_DIM + threadIdx.y;

    for (int j = 0; j < TILE_DIM; j += BLOCK_ROWS)
        odata[(y + j) * width + x] = tile[threadIdx.x][threadIdx.y + j];   // coalesced write
}

__global__ void transposeNoBankConflicts(float* odata, const float* idata)
{
    __shared__ float tile[TILE_DIM][TILE_DIM + 1];   // bank (33r + c) % 32 = (r + c) % 32: all different along a column

    int x = blockIdx.x * TILE_DIM + threadIdx.x;
    int y = blockIdx.y * TILE_DIM + threadIdx.y;
    int width = gridDim.x * TILE_DIM;
    for (int j = 0; j < TILE_DIM; j += BLOCK_ROWS)
        tile[threadIdx.y + j][threadIdx.x] = idata[(y + j) * width + x];
    __syncthreads();
    x = blockIdx.y * TILE_DIM + threadIdx.x;
    y = blockIdx.x * TILE_DIM + threadIdx.y;
    for (int j = 0; j < TILE_DIM; j += BLOCK_ROWS)
        odata[(y + j) * width + x] = tile[threadIdx.x][threadIdx.y + j];
}

// usage: prog [N]   (N×N matrix, rounded down to a multiple of 32; default 2048)
int main(int argc, char** argv) {
    const int N = argc > 1 ? atoi(argv[1]) / TILE_DIM * TILE_DIM : 2048;
    const int n = N * N;
    const size_t bytes = n * sizeof(float);
    std::vector<float> h(n), r(n);
    for (int i = 0; i < n; i++)
        h[i] = (float)i;

    float *idata, *odata;
    cudaMalloc((void**)&idata, bytes);
    cudaMalloc((void**)&odata, bytes);
    cudaMemcpy(idata, h.data(), bytes, cudaMemcpyHostToDevice);
    dim3 grid(N / TILE_DIM, N / TILE_DIM), block(TILE_DIM, BLOCK_ROWS);

    cudaEvent_t a, b;
    cudaEventCreate(&a);
    cudaEventCreate(&b);
    const char* names[] = {"copy", "transposeNaive", "transposeCoalesced", "transposeNoBankConflicts"};
    for (int v = 0; v < 4; v++) {
        cudaMemset(odata, 0, bytes);
        auto launch = [&] {
            if (v == 0)      copy<<<grid, block>>>(odata, idata);
            else if (v == 1) transposeNaive<<<grid, block>>>(odata, idata);
            else if (v == 2) transposeCoalesced<<<grid, block>>>(odata, idata);
            else             transposeNoBankConflicts<<<grid, block>>>(odata, idata);
        };
        launch();                                   // warm-up, not timed
        cudaEventRecord(a);
        for (int k = 0; k < 20; k++) launch();
        cudaEventRecord(b);
        cudaEventSynchronize(b);
        float ms;
        cudaEventElapsedTime(&ms, a, b);
        ms /= 20;

        cudaMemcpy(r.data(), odata, bytes, cudaMemcpyDeviceToHost);
        int bad = 0;
        for (int y = 0; y < N; y++)
            for (int x = 0; x < N; x++) {
                float want = (v == 0) ? h[y * N + x] : h[x * N + y];   // copy keeps, the others transpose
                if (r[y * N + x] != want) bad++;
            }
        printf("%-26s %7.3f ms  %7.1f GB/s  %s\n", names[v], ms, 2.0 * bytes / (ms * 1e6), bad ? "WRONG" : "correct");
    }

    cudaDeviceProp p;
    cudaGetDeviceProperties(&p, 0);
    printf("GPU: %s; matrix %dx%d, blocks of %dx%d threads\n", p.name, N, N, TILE_DIM, BLOCK_ROWS);
    cudaFree(idata);
    cudaFree(odata);
}
