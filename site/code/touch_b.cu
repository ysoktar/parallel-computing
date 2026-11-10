// Midterm 2 exercise (b): k2<<<dim3(2,2), dim3(8,8)>>> on a 16×16 matrix, with x used as the row.
#include <cstdio>

__global__ void k2(int* B, int width) {
    int x = blockIdx.x * blockDim.x + threadIdx.x;
    int y = blockIdx.y * blockDim.y + threadIdx.y;
    B[x * width + y] = threadIdx.x;      // careful: x is used as the row!
}

int main() {
    const int W = 16; int h[W * W];
    int* B; cudaMalloc((void**)&B, sizeof h); cudaMemset(B, 0xff, sizeof h);
    k2<<<dim3(2, 2), dim3(8, 8)>>>(B, W);
    cudaMemcpy(h, B, sizeof h, cudaMemcpyDeviceToHost);
    for (int r = 0; r < W; r++) { for (int c = 0; c < W; c++) printf("%2d", h[r * W + c]); printf("\n"); }
    printf("B[181] = %d (thread blockIdx=(1,0) threadIdx=(3,5): x=11, y=5)\n", h[181]);
    printf("→ every element of row r is r %% 8; the fix for coalescing is B[y * width + x]\n");
    cudaFree(B);
}
