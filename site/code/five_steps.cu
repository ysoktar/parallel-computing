// L5: the five host steps around a kernel: allocate device memory, copy the inputs, launch, copy the result back,
// free. Uses the blocked matmul kernel of slide 39 and checks the result on the CPU.
#include <cstdio>
#include <cstdlib>
#define TILE_WIDTH 16

__global__ void MatMulKernel(float* Md, float* Nd, float* Pd, int width)
{
    int row = blockIdx.y * TILE_WIDTH + threadIdx.y;
    int col = blockIdx.x * TILE_WIDTH + threadIdx.x;
    float sum = 0;
    for (int i = 0; i < width; i++)
        sum += Md[row * width + i] * Nd[i * width + col];
    Pd[row * width + col] = sum;
}

void cuMatrixMultiplication(float* M, float* N, float* P, int width)
{
    int size = width * width * sizeof(float);
    float *Md, *Nd, *Pd;
    // 1. allocate device memory
    cudaMalloc((void**)&Md, size);
    cudaMalloc((void**)&Nd, size);
    cudaMalloc((void**)&Pd, size);
    // 2. copy the inputs to the device
    cudaMemcpy(Md, M, size, cudaMemcpyHostToDevice);
    cudaMemcpy(Nd, N, size, cudaMemcpyHostToDevice);
    // 3. launch the kernel
    dim3 dimBlock(TILE_WIDTH, TILE_WIDTH);
    dim3 dimGrid(width / TILE_WIDTH, width / TILE_WIDTH);
    MatMulKernel<<<dimGrid, dimBlock>>>(Md, Nd, Pd, width);
    // 4. copy the result back to the host
    cudaMemcpy(P, Pd, size, cudaMemcpyDeviceToHost);
    // 5. free device memory
    cudaFree(Md); cudaFree(Nd); cudaFree(Pd);
}

// usage: prog [width]   (a multiple of 16; default 256)
int main(int argc, char** argv) {
    int width = argc > 1 ? atoi(argv[1]) / TILE_WIDTH * TILE_WIDTH : 256;
    if (width < TILE_WIDTH) width = TILE_WIDTH;
    float* M = new float[width * width]; float* N = new float[width * width]; float* P = new float[width * width];
    for (int i = 0; i < width * width; i++) { M[i] = rand() % 4; N[i] = rand() % 4; }
    cuMatrixMultiplication(M, N, P, width);
    int bad = 0;
    for (int i = 0; i < width; i++) for (int j = 0; j < width; j++) {
        float s = 0; for (int k = 0; k < width; k++) s += M[i * width + k] * N[k * width + j];
        if (s != P[i * width + j]) bad++;
    }
    printf("%dx%d matmul on the GPU: %s (P[0] = %g); last error: %s\n", width, width,
           bad ? "MISMATCH" : "matches the CPU", P[0], cudaGetErrorString(cudaGetLastError()));
    delete[] M; delete[] N; delete[] P;
}
