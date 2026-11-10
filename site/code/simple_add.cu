// L4/L5: the simplest kernels. VecAdd: one block of N threads, thread i adds element i.
// MatAdd: one block of N×N threads, linear index threadIdx.y * blockDim.x + threadIdx.x.
#include <cstdio>
#define CHECK(x) do { cudaError_t e = (x); if (e != cudaSuccess) { printf("CUDA error %s at line %d\n", cudaGetErrorString(e), __LINE__); return 1; } } while (0)

__global__ void VecAdd(float* A, float* B, float* C) {   // <<<1, N>>>: 1 block, N threads
    int i = threadIdx.x;
    C[i] = A[i] + B[i];
}
__global__ void MatAdd(float* A, float* B, float* C) {   // <<<1, dim3(N, N)>>>
    const int i = threadIdx.y * blockDim.x + threadIdx.x;
    C[i] = A[i] + B[i];
}

int main() {
    const int N = 8, NN = N * N;
    float hA[NN], hB[NN], hC[NN];
    for (int k = 0; k < NN; k++) { hA[k] = k; hB[k] = 1000; }
    float *A, *B, *C;
    CHECK(cudaMalloc((void**)&A, NN * sizeof(float)));
    CHECK(cudaMalloc((void**)&B, NN * sizeof(float)));
    CHECK(cudaMalloc((void**)&C, NN * sizeof(float)));
    CHECK(cudaMemcpy(A, hA, NN * sizeof(float), cudaMemcpyHostToDevice));
    CHECK(cudaMemcpy(B, hB, NN * sizeof(float), cudaMemcpyHostToDevice));

    VecAdd<<<1, N>>>(A, B, C);
    CHECK(cudaGetLastError());
    CHECK(cudaMemcpy(hC, C, N * sizeof(float), cudaMemcpyDeviceToHost));
    printf("VecAdd, first %d elements:", N);
    for (int i = 0; i < N; i++) printf(" %g", hC[i]);
    printf("\n");

    MatAdd<<<1, dim3(N, N)>>>(A, B, C);
    CHECK(cudaGetLastError());
    CHECK(cudaMemcpy(hC, C, NN * sizeof(float), cudaMemcpyDeviceToHost));
    printf("MatAdd %dx%d:\n", N, N);
    for (int r = 0; r < N; r++) { for (int c = 0; c < N; c++) printf("%6g", hC[r * N + c]); printf("\n"); }
    cudaFree(A); cudaFree(B); cudaFree(C);
}
