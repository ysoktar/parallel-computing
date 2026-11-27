// CUDA quiz, question 30: 16×16 tiled matmul for N = 100, which is not a multiple of 16: grid (7,7), 7 phases.
// Loads that fall outside the matrix store 0, and every thread (also those outside the matrix) reaches both barriers.
#include <cstdio>
#include <cstdlib>
#define T 16   // tile width = block width

__global__ void matmul(const float* A, const float* B, float* C, int N) {
    __shared__ float a[T][T], b[T][T];
    int x = threadIdx.x, y = threadIdx.y;
    int r = blockIdx.y * T + y, c = blockIdx.x * T + x;      // this thread's element of C
    float s = 0;
    for (int p = 0; p < (N + T - 1) / T; p++) {               // phase p: tiles p of A's row band and B's column band
        int kx = p * T + x, ky = p * T + y;
        a[y][x] = (r < N && kx < N) ? A[r * N + kx] : 0;
        b[y][x] = (ky < N && c < N) ? B[ky * N + c] : 0;
        __syncthreads();                                      // (1) both tiles are full
        for (int k = 0; k < T; k++)
            s += a[y][k] * b[k][x];
        __syncthreads();                                      // (2) everyone is done before the next phase overwrites
    }
    if (r < N && c < N) C[r * N + c] = s;
}

// usage: prog [N]   (default 100)
int main(int argc, char** argv) {
    int N = argc > 1 ? atoi(argv[1]) : 100;
    size_t bytes = (size_t)N * N * sizeof(float);
    float* A = new float[N * N];
    float* B = new float[N * N];
    float* C = new float[N * N];
    for (int i = 0; i < N * N; i++) {
        A[i] = rand() % 4;
        B[i] = rand() % 4;
    }

    float *dA, *dB, *dC;
    cudaMalloc((void**)&dA, bytes);
    cudaMalloc((void**)&dB, bytes);
    cudaMalloc((void**)&dC, bytes);
    cudaMemcpy(dA, A, bytes, cudaMemcpyHostToDevice);
    cudaMemcpy(dB, B, bytes, cudaMemcpyHostToDevice);
    dim3 block(T, T), grid((N + T - 1) / T, (N + T - 1) / T);
    matmul<<<grid, block>>>(dA, dB, dC, N);
    cudaMemcpy(C, dC, bytes, cudaMemcpyDeviceToHost);

    int bad = 0;                                              // compare with the CPU
    for (int r = 0; r < N; r++)
        for (int c = 0; c < N; c++) {
            float s = 0;
            for (int k = 0; k < N; k++)
                s += A[r * N + k] * B[k * N + c];
            if (s != C[r * N + c]) bad++;
        }
    printf("N=%d: grid %dx%d, %d phases, %d threads (%d valid): %s\n",
           N, grid.x, grid.y, (N + T - 1) / T, grid.x * grid.y * T * T, N * N, bad ? "MISMATCH" : "matches the CPU");
    cudaFree(dA);
    cudaFree(dB);
    cudaFree(dC);
    delete[] A;
    delete[] B;
    delete[] C;
}
