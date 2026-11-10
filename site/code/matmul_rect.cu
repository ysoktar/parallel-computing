// Midterm 2 worked example: <<<dim3(3,3), dim3(8,32)>>>. P is 96×24, M is 96×K, N is K×24.
// MatMul: each thread one element of P. MatMulTiled: the same launch with Mds[32][8] and Nds[8][8].
#include <cstdio>
#include <cstdlib>
#define CHECK(x) do { cudaError_t e = (x); if (e != cudaSuccess) { printf("CUDA error %s at line %d\n", cudaGetErrorString(e), __LINE__); return 1; } } while (0)

__global__ void MatMul(const float* M, const float* N, float* P, int K, int Pcols)
{
    int row = blockIdx.y * blockDim.y + threadIdx.y;   // 0..95
    int col = blockIdx.x * blockDim.x + threadIdx.x;   // 0..23
    float sum = 0;
    for (int k = 0; k < K; ++k)
        sum += M[row * K + k] * N[k * Pcols + col];
    P[row * Pcols + col] = sum;
    if (blockIdx.x == 2 && blockIdx.y == 1 && threadIdx.x == 5 && threadIdx.y == 10) {
        int id = threadIdx.y * blockDim.x + threadIdx.x;
        printf("thread blockIdx=(2,1) threadIdx=(5,10): row=%d col=%d linear id=%d warp=%d writes P[%d]\n",
               row, col, id, id / 32, row * Pcols + col);
    }
}

#define BX 8    // blockDim.x  = number of columns of the P tile
#define BY 32   // blockDim.y  = number of rows of the P tile
#define TK 8    // width taken along k in each phase

__global__ void MatMulTiled(const float* M, const float* N, float* P, int K, int Pcols)
{
    __shared__ float Mds[BY][TK];   // 32×8 = 256 elements: every thread loads one
    __shared__ float Nds[TK][BX];   //  8×8 =  64 elements: only threads with ty < 8 load
    int tx = threadIdx.x, ty = threadIdx.y;
    int row = blockIdx.y * BY + ty;
    int col = blockIdx.x * BX + tx;
    float sum = 0;
    for (int m = 0; m < K / TK; ++m) {
        Mds[ty][tx] = M[row * K + (m * TK + tx)];
        if (ty < TK)
            Nds[ty][tx] = N[(m * TK + ty) * Pcols + col];
        __syncthreads();                  // tiles completely filled (OUTSIDE the if!)
        for (int k = 0; k < TK; ++k)
            sum += Mds[ty][k] * Nds[k][tx];
        __syncthreads();                  // nobody overwrites for the next phase before all are done
    }
    P[row * Pcols + col] = sum;
}

int main() {
    const int R = 96, C = 24, K = 64;
    static float hM[R * K], hN[K * C], hP[R * C], ref[R * C];
    for (int i = 0; i < R * K; i++) hM[i] = rand() % 5;
    for (int i = 0; i < K * C; i++) hN[i] = rand() % 5;
    for (int i = 0; i < R; i++) for (int j = 0; j < C; j++) { float s = 0; for (int k = 0; k < K; k++) s += hM[i * K + k] * hN[k * C + j]; ref[i * C + j] = s; }
    float *M, *N, *P;
    CHECK(cudaMalloc((void**)&M, sizeof hM)); CHECK(cudaMalloc((void**)&N, sizeof hN)); CHECK(cudaMalloc((void**)&P, sizeof hP));
    CHECK(cudaMemcpy(M, hM, sizeof hM, cudaMemcpyHostToDevice));
    CHECK(cudaMemcpy(N, hN, sizeof hN, cudaMemcpyHostToDevice));
    printf("grid 3x3 blocks of 8x32 threads = %d threads, %d warps; P covers %d rows x %d cols\n", 9 * 256, 9 * 8, 3 * 32, 3 * 8);
    for (int v = 0; v < 2; v++) {
        CHECK(cudaMemset(P, 0, sizeof hP));
        if (v == 0) MatMul<<<dim3(3, 3), dim3(8, 32)>>>(M, N, P, K, C);
        else        MatMulTiled<<<dim3(3, 3), dim3(8, 32)>>>(M, N, P, K, C);
        CHECK(cudaGetLastError()); CHECK(cudaDeviceSynchronize());
        CHECK(cudaMemcpy(hP, P, sizeof hP, cudaMemcpyDeviceToHost));
        int bad = 0; for (int i = 0; i < R * C; i++) if (hP[i] != ref[i]) bad++;
        printf("%s: %s\n", v ? "MatMulTiled" : "MatMul     ", bad ? "MISMATCH" : "all 2304 elements match the CPU");
    }
    cudaFree(M); cudaFree(N); cudaFree(P);
}
