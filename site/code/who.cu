// Lab: print what one thread sees. Change the condition or the launch to check any index question.
#include <cstdio>
__global__ void who(int width) {
    int col = blockIdx.x * blockDim.x + threadIdx.x;
    int row = blockIdx.y * blockDim.y + threadIdx.y;
    int id  = threadIdx.y * blockDim.x + threadIdx.x;
    if (blockIdx.x == 2 && blockIdx.y == 1 && threadIdx.x == 5 && threadIdx.y == 10)
        printf("row=%d col=%d warp=%d P[%d]\n", row, col, id / 32, row * width + col);
}
int main() {
    who<<<dim3(3, 3), dim3(8, 32)>>>(24);
    cudaDeviceSynchronize();   // kernels are asynchronous: wait to see the output
}
