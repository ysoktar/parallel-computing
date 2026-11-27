// Lab page: print what one chosen thread sees (its row, column, warp and the element of P it writes).
// Change the condition in the kernel or the launch in main() to check any index question.
#include <cstdio>

__global__ void who(int width) {
    int col = blockIdx.x * blockDim.x + threadIdx.x;   // x gives the column
    int row = blockIdx.y * blockDim.y + threadIdx.y;   // y gives the row
    int id  = threadIdx.y * blockDim.x + threadIdx.x;  // linear id inside the block → warp = id / 32
    if (blockIdx.x == 2 && blockIdx.y == 1 && threadIdx.x == 5 && threadIdx.y == 10)
        printf("row=%d col=%d warp=%d P[%d]\n", row, col, id / 32, row * width + col);
}

int main() {
    who<<<dim3(3, 3), dim3(8, 32)>>>(24);   // P is 96 rows × 24 columns
    cudaDeviceSynchronize();   // kernels are asynchronous: wait to see the output
}
