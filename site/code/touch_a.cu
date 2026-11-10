// Midterm 2 exercise (a): which elements of the 8×8 matrix A does k<<<2, 4>>>(A, 8) touch?
#include <cstdio>

__global__ void k(float* A, int N) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;   // 0..7
    A[i * N] = 0;
}

int main() {
    float h[64]; for (int i = 0; i < 64; i++) h[i] = 1;
    float* A; cudaMalloc((void**)&A, sizeof h); cudaMemcpy(A, h, sizeof h, cudaMemcpyHostToDevice);
    k<<<2, 4>>>(A, 8);
    cudaMemcpy(h, A, sizeof h, cudaMemcpyDeviceToHost);
    printf("A after the kernel (0 = written by a thread):\n");
    for (int r = 0; r < 8; r++) { for (int c = 0; c < 8; c++) printf("%2g", h[r * 8 + c]); printf("\n"); }
    printf("→ column 0; consecutive threads are 8 floats (32 B) apart: not coalesced\n");
    cudaFree(A);
}
