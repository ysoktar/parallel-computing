// Quiz Q6: rectangular matmul, A = 35×19, B = 19×65, C = 35×65, 16×16 blocks, grid (5,3).
// Trap: A's row stride is K = 19, B's and C's is N = 65.
#include <cstdio>
#include <cstdlib>

__global__ void mm(const float* A,const float* B,float* C,
                   int M,int K,int N) {
    int r=blockIdx.y*blockDim.y+threadIdx.y;
    int c=blockIdx.x*blockDim.x+threadIdx.x;
    if(r>=M || c>=N) return;
    float s=0;
    for(int k=0;k<K;k++) s+=A[r*K+k]*B[k*N+c];
    C[r*N+c]=s;
}

int main() {
    const int M = 35, K = 19, N = 65;
    static float A[M*K], B[K*N], C[M*N];
    for (int i = 0; i < M*K; i++) A[i] = rand() % 5;
    for (int i = 0; i < K*N; i++) B[i] = rand() % 5;
    float *dA, *dB, *dC;
    cudaMalloc((void**)&dA, sizeof A); cudaMalloc((void**)&dB, sizeof B); cudaMalloc((void**)&dC, sizeof C);
    cudaMemcpy(dA, A, sizeof A, cudaMemcpyHostToDevice); cudaMemcpy(dB, B, sizeof B, cudaMemcpyHostToDevice);
    mm<<<dim3(5,3),dim3(16,16)>>>(dA,dB,dC,35,19,65);
    cudaMemcpy(C, dC, sizeof C, cudaMemcpyDeviceToHost);
    int bad = 0;
    for (int r = 0; r < M; r++) for (int c = 0; c < N; c++) { float s = 0; for (int k = 0; k < K; k++) s += A[r*K+k]*B[k*N+c]; if (s != C[r*N+c]) bad++; }
    printf("C = %dx%d (%d outputs), grid 5x3 of 16x16 = 3840 threads, 1565 idle: %s\n", M, N, M*N, bad ? "MISMATCH" : "matches the CPU");
    cudaFree(dA); cudaFree(dB); cudaFree(dC);
}
