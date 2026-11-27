// Pages 5.2 and 5.3: the five host steps (allocate, copy in, launch, copy back, free) around two kernels: the blocked
// matmul of slide 39 (every operand from global memory) and the tiled shared-memory matmul of slide 90. Both are checked
// against the CPU and timed.
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <vector>
#define TILE_WIDTH 16

// stop the program with a message if a CUDA call fails
#define CHECK(x) do {                                                                   \
        cudaError_t e = (x);                                                            \
        if (e != cudaSuccess) {                                                         \
            printf("CUDA error %s at line %d\n", cudaGetErrorString(e), __LINE__);      \
            exit(1);                                                                    \
        }                                                                               \
    } while (0)

__global__ void MatMulKernel(float* Md, float* Nd, float* Pd, int width)
{
    int row = blockIdx.y * TILE_WIDTH + threadIdx.y;
    int col = blockIdx.x * TILE_WIDTH + threadIdx.x;
    float sum = 0;
    for (int i = 0; i < width; i++)
        sum += Md[row * width + i] * Nd[i * width + col];
    Pd[row * width + col] = sum;
}

__global__ void MatrixMulKernel(float* Md, float* Nd, float* Pd, int width)
{
    __shared__ float Mds[TILE_WIDTH][TILE_WIDTH];
    __shared__ float Nds[TILE_WIDTH][TILE_WIDTH];
    int bx = blockIdx.x, by = blockIdx.y;
    int tx = threadIdx.x, ty = threadIdx.y;
    int Row = by * TILE_WIDTH + ty;     // this thread's row of P
    int Col = bx * TILE_WIDTH + tx;     // this thread's column of P
    float Pvalue = 0;
    for (int m = 0; m < width / TILE_WIDTH; ++m) {           // phase loop
        Mds[ty][tx] = Md[Row * width + (m * TILE_WIDTH + tx)];   // M[Row][m*T + tx]
        Nds[ty][tx] = Nd[(m * TILE_WIDTH + ty) * width + Col];   // N[m*T + ty][Col]
        __syncthreads();                                      // (1) the tiles are full
        for (int k = 0; k < TILE_WIDTH; ++k)
            Pvalue += Mds[ty][k] * Nds[k][tx];
        __syncthreads();                                      // (2) everyone has finished using them
    }
    Pd[Row * width + Col] = Pvalue;
}

// Runs one of the kernels on M × N → P and returns the kernel time in ms.
float cuMatrixMultiplication(float* M, float* N, float* P, int width, bool tiled)
{
    int size = width * width * sizeof(float);
    float *Md, *Nd, *Pd;
    // 1. allocate device memory
    CHECK(cudaMalloc((void**)&Md, size));
    CHECK(cudaMalloc((void**)&Nd, size));
    CHECK(cudaMalloc((void**)&Pd, size));
    // 2. copy the inputs to the device
    CHECK(cudaMemcpy(Md, M, size, cudaMemcpyHostToDevice));
    CHECK(cudaMemcpy(Nd, N, size, cudaMemcpyHostToDevice));
    // 3. launch the kernel (timed with events, because a launch is asynchronous)
    dim3 dimBlock(TILE_WIDTH, TILE_WIDTH);
    dim3 dimGrid(width / TILE_WIDTH, width / TILE_WIDTH);
    auto launch = [&] {
        if (tiled) MatrixMulKernel<<<dimGrid, dimBlock>>>(Md, Nd, Pd, width);
        else       MatMulKernel<<<dimGrid, dimBlock>>>(Md, Nd, Pd, width);
    };
    cudaEvent_t a, b;
    cudaEventCreate(&a);
    cudaEventCreate(&b);
    launch();                                   // warm-up, not timed
    cudaEventRecord(a);
    launch();
    cudaEventRecord(b);
    CHECK(cudaEventSynchronize(b));
    CHECK(cudaGetLastError());
    float ms;
    cudaEventElapsedTime(&ms, a, b);
    // 4. copy the result back to the host
    CHECK(cudaMemcpy(P, Pd, size, cudaMemcpyDeviceToHost));
    // 5. free device memory
    cudaFree(Md); cudaFree(Nd); cudaFree(Pd);
    return ms;
}

// usage: prog [width]   (rounded down to a multiple of TILE_WIDTH = 16; default 1024)
int main(int argc, char** argv) {
    const int width = argc > 1 ? atoi(argv[1]) / TILE_WIDTH * TILE_WIDTH : 1024;
    std::vector<float> M(width * width), N(width * width), P(width * width);
    for (int i = 0; i < width * width; i++) {
        M[i] = (i % 7) * 0.5f;
        N[i] = (i % 5) * 0.25f;
    }

    for (int tiled = 0; tiled <= 1; tiled++) {
        float ms = cuMatrixMultiplication(M.data(), N.data(), P.data(), width, tiled);
        int bad = 0;                                           // spot-check 64 elements against the CPU
        for (int t = 0; t < 64; t++) {
            int i = (t * 131) % width, j = (t * 977) % width;
            double s = 0;
            for (int k = 0; k < width; k++)
                s += (double)M[i * width + k] * N[k * width + j];
            if (fabs(s - P[i * width + j]) > 1e-2 * fabs(s) + 1e-3) bad++;
        }
        double gflops = 2.0 * width * width * width / (ms * 1e6);   // 2·width³ FLOPs (multiply + add)
        printf("%-28s %dx%d: %7.3f ms, %6.1f GFLOPS, %s\n", tiled ? "tiled (shared memory):" : "blocked (global memory):",
               width, width, ms, gflops, bad ? "MISMATCH" : "correct");
    }
}
