// Quiz Q23: the barrier must be reached by every thread, so the bounds check moves off the load and the barrier:
// out-of-range threads load 0 into the tile, everyone passes __syncthreads(), only valid threads write.
#include <cstdio>
#include <cstdlib>
#define BS 128

__global__ void fixed(const float* A, float* B, int N) {
    __shared__ float tile[BS];
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    tile[threadIdx.x]=(i<N)?A[i]:0;
    __syncthreads();
    if(i<N) B[i]=tile[(threadIdx.x+1)%blockDim.x];
}

// usage: prog [N]   (default 300: the last block is partly empty)
int main(int argc, char** argv) {
    int N = argc > 1 ? atoi(argv[1]) : 300;
    float *A = new float[N], *B = new float[N];
    for (int i = 0; i < N; i++) A[i] = i;
    float *dA, *dB; cudaMalloc((void**)&dA, N*sizeof(float)); cudaMalloc((void**)&dB, N*sizeof(float));
    cudaMemcpy(dA, A, N*sizeof(float), cudaMemcpyHostToDevice);
    fixed<<<(N+BS-1)/BS, BS>>>(dA, dB, N);
    cudaMemcpy(B, dB, N*sizeof(float), cudaMemcpyDeviceToHost);
    printf("B[0]=%g B[127]=%g (wraps within the block) B[%d]=%g (last element: its neighbour is out of range → 0)\n", B[0], B[127], N-1, B[N-1]);
    printf("(%s)\n", cudaGetErrorString(cudaGetLastError()));
    cudaFree(dA); cudaFree(dB); delete[] A; delete[] B;
}
