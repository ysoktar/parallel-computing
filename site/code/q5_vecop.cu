// Quiz Q5: C[i] = 2A[i] + B[i]; one thread per output, N need not be a multiple of the block size.
#include <cstdio>
#include <cstdlib>

__global__ void f(const float* A,const float* B,
                  float* C,int N) {
    int i=blockIdx.x*blockDim.x+threadIdx.x;
    if(i<N) C[i]=2*A[i]+B[i];
}

// usage: prog [N]   (default 1000)
int main(int argc, char** argv) {
    int N = argc > 1 ? atoi(argv[1]) : 1000;
    float *A = new float[N], *B = new float[N], *C = new float[N];
    for (int i = 0; i < N; i++) { A[i] = i; B[i] = 1; }
    float *dA, *dB, *dC;
    cudaMalloc((void**)&dA, N*sizeof(float)); cudaMalloc((void**)&dB, N*sizeof(float)); cudaMalloc((void**)&dC, N*sizeof(float));
    cudaMemcpy(dA,A,N*sizeof(float),cudaMemcpyHostToDevice);
    cudaMemcpy(dB,B,N*sizeof(float),cudaMemcpyHostToDevice);
    f<<<(N+255)/256,256>>>(dA,dB,dC,N);
    cudaMemcpy(C,dC,N*sizeof(float),cudaMemcpyDeviceToHost);
    cudaFree(dA); cudaFree(dB); cudaFree(dC);
    int bad = 0; for (int i = 0; i < N; i++) if (C[i] != 2.0f*i + 1) bad++;
    printf("N=%d, %d blocks: C[%d]=%g, %s\n", N, (N+255)/256, N-1, C[N-1], bad ? "MISMATCH" : "correct");
    delete[] A; delete[] B; delete[] C;
}
