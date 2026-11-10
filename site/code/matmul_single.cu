// L5 slide 23: the first matmul kernel: ONE block, thread (tx, ty) computes Pd[ty][tx]. Width is limited by the
// threads-per-block limit (1024 → at most 32×32).
#include <cstdio>
#include <cstdlib>
#define CHECK(x) do { cudaError_t e = (x); if (e != cudaSuccess) { printf("CUDA error %s at line %d\n", cudaGetErrorString(e), __LINE__); return 1; } } while (0)

__global__ void MatMulKernel(float* Md, float* Nd, float* Pd, int width)
{
    int tx = threadIdx.x;
    int ty = threadIdx.y;
    float sum = 0;
    for (int i = 0; i < width; i++)
        sum += Md[ty * width + i] * Nd[i * width + tx];
    Pd[ty * width + tx] = sum;
}

int main() {
    const int width = 16, size = width * width * sizeof(float);
    float M[width * width], N[width * width], P[width * width];
    for (int i = 0; i < width * width; i++) { M[i] = rand() % 10; N[i] = rand() % 10; }
    float *Md, *Nd, *Pd;
    CHECK(cudaMalloc((void**)&Md, size)); CHECK(cudaMalloc((void**)&Nd, size)); CHECK(cudaMalloc((void**)&Pd, size));
    CHECK(cudaMemcpy(Md, M, size, cudaMemcpyHostToDevice));
    CHECK(cudaMemcpy(Nd, N, size, cudaMemcpyHostToDevice));
    dim3 blockDim(width, width); dim3 gridDim(1, 1);
    MatMulKernel<<<gridDim, blockDim>>>(Md, Nd, Pd, width);
    CHECK(cudaGetLastError());
    CHECK(cudaMemcpy(P, Pd, size, cudaMemcpyDeviceToHost));
    int bad = 0;
    for (int i = 0; i < width; i++) for (int j = 0; j < width; j++) {
        float s = 0; for (int k = 0; k < width; k++) s += M[i * width + k] * N[k * width + j];
        if (s != P[i * width + j]) bad++;
    }
    printf("%dx%d with one %dx%d block: %s (P[0][0] = %g)\n", width, width, width, width, bad ? "MISMATCH" : "matches the CPU", P[0]);
    // try width = 33: 33*33 = 1089 threads > 1024 → the launch fails
    MatMulKernel<<<1, dim3(33, 33)>>>(Md, Nd, Pd, 33);
    printf("launch with a 33x33 block: %s\n", cudaGetErrorString(cudaGetLastError()));
    cudaFree(Md); cudaFree(Nd); cudaFree(Pd);
}
