// CUDA quiz, question 23: every thread of the block must reach __syncthreads(), so the bounds check moves off the load
// and the barrier: out-of-range threads load 0 into the tile, everyone passes the barrier, only valid threads write.
#include <cstdio>
#include <cstdlib>
#define BS 128   // block size

__global__ void fixed(const float* A, float* B, int N) {
    __shared__ float tile[BS];
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    tile[threadIdx.x] = (i < N) ? A[i] : 0;                    // every thread fills its slot (0 if outside)
    __syncthreads();                                            // reached by all threads of the block
    if (i < N) B[i] = tile[(threadIdx.x + 1) % blockDim.x];     // read the right neighbour, loaded by ANOTHER thread
}

// usage: prog [N]   (default 300: the last block is partly empty)
int main(int argc, char** argv) {
    int N = argc > 1 ? atoi(argv[1]) : 300;
    size_t bytes = N * sizeof(float);
    float* A = new float[N];
    float* B = new float[N];
    for (int i = 0; i < N; i++)
        A[i] = i;

    float *dA, *dB;
    cudaMalloc((void**)&dA, bytes);
    cudaMalloc((void**)&dB, bytes);
    cudaMemcpy(dA, A, bytes, cudaMemcpyHostToDevice);
    fixed<<<(N + BS - 1) / BS, BS>>>(dA, dB, N);
    cudaMemcpy(B, dB, bytes, cudaMemcpyDeviceToHost);

    printf("B[0]=%g B[127]=%g (wraps within the block) B[%d]=%g (last element: its neighbour is out of range → 0)\n",
           B[0], B[127], N - 1, B[N - 1]);
    printf("(%s)\n", cudaGetErrorString(cudaGetLastError()));
    cudaFree(dA);
    cudaFree(dB);
    delete[] A;
    delete[] B;
}
