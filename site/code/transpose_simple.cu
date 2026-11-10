// Midterm 2 summary: naive transpose (read coalesced, write strided) vs transpose through a shared-memory tile
// (both coalesced). in is height×width, out is width×height; blocks of TILE×TILE threads. Timed with events.
#include <cstdio>
#include <vector>
#define TILE 32

__global__ void transposeNaive(float* out, const float* in, int width, int height) {
    // in: height×width, out: width×height
    int x = blockIdx.x * TILE + threadIdx.x;  // column
    int y = blockIdx.y * TILE + threadIdx.y;  // row
    if (x < width && y < height)
        out[x * height + y] = in[y * width + x];
    // x is consecutive within a warp: in is read consecutively, out is written 'height' apart
}

__global__ void transposeShared(float* out, const float* in, int width, int height) {
    __shared__ float tile[TILE][TILE];
    int x = blockIdx.x * TILE + threadIdx.x;
    int y = blockIdx.y * TILE + threadIdx.y;
    tile[threadIdx.y][threadIdx.x] = in[y * width + x];
    __syncthreads();
    x = blockIdx.y * TILE + threadIdx.x;   // blocks swap places
    y = blockIdx.x * TILE + threadIdx.y;
    out[y * height + x] = tile[threadIdx.x][threadIdx.y];
}

// usage: prog [width] [height]   (multiples of 32; default 4096 2048)
#include <cstdlib>
int main(int argc, char** argv) {
    const int width = argc > 1 ? atoi(argv[1]) / TILE * TILE : 4096, height = argc > 2 ? atoi(argv[2]) / TILE * TILE : 2048, n = width * height;   // multiples of TILE
    std::vector<float> h(n), r(n);
    for (int i = 0; i < n; i++) h[i] = (float)i;
    float *in, *out; cudaMalloc((void**)&in, n * 4); cudaMalloc((void**)&out, n * 4);
    cudaMemcpy(in, h.data(), n * 4, cudaMemcpyHostToDevice);
    dim3 block(TILE, TILE), grid(width / TILE, height / TILE);
    cudaEvent_t a, b; cudaEventCreate(&a); cudaEventCreate(&b);
    for (int v = 0; v < 2; v++) {
        cudaMemset(out, 0, n * 4);
        auto launch = [&] { if (v == 0) transposeNaive<<<grid, block>>>(out, in, width, height);
                            else        transposeShared<<<grid, block>>>(out, in, width, height); };
        launch(); cudaEventRecord(a); for (int k = 0; k < 10; k++) launch(); cudaEventRecord(b); cudaEventSynchronize(b);
        float ms; cudaEventElapsedTime(&ms, a, b); ms /= 10;
        cudaMemcpy(r.data(), out, n * 4, cudaMemcpyDeviceToHost);
        int bad = 0; for (int y = 0; y < height; y++) for (int x = 0; x < width; x++) if (r[x * height + y] != h[y * width + x]) bad++;
        printf("%-16s %.3f ms, %6.1f GB/s, %s\n", v ? "shared tile:" : "naive:", ms, 2.0 * n * 4 / (ms * 1e6), bad ? "WRONG" : "correct");
    }
    printf("(%s)\n", cudaGetErrorString(cudaGetLastError()));
    cudaFree(in); cudaFree(out);
}
