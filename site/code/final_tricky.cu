// Final prep page: the code of the hard questions. Buggy kernels are compiled so you can read them, but only the
// fixed versions are launched (a missing barrier or a barrier inside an if is undefined behaviour).
#include <cstdio>
#include <cstdlib>
#define T 16
#define BINS 64

// Q-K1: a tiled matmul with the second barrier missing (BUGGY, not launched)
__global__ void tiledNoSecondSync(const float* M, const float* N, float* P, int width) {
    __shared__ float Ms[T][T], Ns[T][T];
    int tx = threadIdx.x, ty = threadIdx.y;
    int row = blockIdx.y * T + ty, col = blockIdx.x * T + tx;
    float sum = 0;
    for (int m = 0; m < width / T; ++m) {
        Ms[ty][tx] = M[row * width + m * T + tx];
        Ns[ty][tx] = N[(m * T + ty) * width + col];
        __syncthreads();
        for (int k = 0; k < T; ++k)
            sum += Ms[ty][k] * Ns[k][tx];
    }
    P[row * width + col] = sum;
}

// Q-K2: an early return before the barrier (BUGGY, not launched)
__global__ void earlyReturn(const float* in, float* out, int n) {
    __shared__ float s[256];
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i >= n) return;
    s[threadIdx.x] = in[i];
    __syncthreads();
    out[i] = s[255 - threadIdx.x];
}

// Q-K3: a shared-memory histogram. hist[bin]++ without an atomic loses updates (BUGGY, not launched).
__global__ void histRacy(const unsigned char* data, int n, unsigned int* hist) {
    __shared__ unsigned int local[BINS];
    if (threadIdx.x < BINS) local[threadIdx.x] = 0;
    __syncthreads();
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i < n) local[data[i] % BINS]++;
    __syncthreads();
    if (threadIdx.x < BINS) hist[threadIdx.x] += local[threadIdx.x];
}

// Q-K3, fixed: atomics in shared memory, then one atomic per bin and block in global memory
__global__ void histFixed(const unsigned char* data, int n, unsigned int* hist) {
    __shared__ unsigned int local[BINS];
    if (threadIdx.x < BINS) local[threadIdx.x] = 0;
    __syncthreads();                                   // (1) the local histogram is zero
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i < n) atomicAdd(&local[data[i] % BINS], 1u);
    __syncthreads();                                   // (2) every thread of the block has counted
    if (threadIdx.x < BINS) atomicAdd(&hist[threadIdx.x], local[threadIdx.x]);
}

// Q-K4: which index is the row? (the "transposed" mapping)
__global__ void scaleWrong(float* A, int W, int H) {
    int row = blockIdx.x * blockDim.x + threadIdx.x;
    int col = blockIdx.y * blockDim.y + threadIdx.y;
    if (row < H && col < W) A[row * W + col] *= 2;
}

// Q-K5: a loop whose trip count depends on the thread, with a barrier inside (BUGGY, not launched)
__global__ void barrierInLoop(float* a) {
    __shared__ float s[128];
    s[threadIdx.x] = a[threadIdx.x];
    for (int k = 0; k < threadIdx.x % 4; ++k) {
        __syncthreads();
        s[threadIdx.x] += s[(threadIdx.x + 1) % 128];
    }
    a[threadIdx.x] = s[threadIdx.x];
}

// Q-K6: bank conflicts of three reads from a 32×32 float tile (one warp, threadIdx.x = 0..31)
__global__ void banks(float* out) {
    __shared__ float tile[32][32];
    int t = threadIdx.x;
    for (int r = 0; r < 32; ++r) tile[r][t] = r * 32 + t;
    __syncthreads();
    float a = tile[t][0];          // column 0
    float b = tile[t][t];          // the diagonal
    float c = tile[t / 2][t % 2];  // two columns, 16 rows
    out[t] = a + b + c;
}

// Q-C1: a reverse loop with an unsigned counter (host code)
void reverseCopy(const float* in, float* out, unsigned n) {
    for (unsigned i = n - 1; i >= 0; i--)
        out[n - 1 - i] = in[i];
}

int main() {
    // histogram: 1 << 20 bytes, value i % 251, checked against the CPU
    const int n = 1 << 20;
    unsigned char* h = new unsigned char[n];
    unsigned int ref[BINS] = {0}, got[BINS];
    for (int i = 0; i < n; i++) {
        h[i] = i % 251;
        ref[h[i] % BINS]++;
    }
    unsigned char* d;
    unsigned int* hist;
    cudaMalloc((void**)&d, n);
    cudaMalloc((void**)&hist, sizeof got);
    cudaMemcpy(d, h, n, cudaMemcpyHostToDevice);
    cudaMemset(hist, 0, sizeof got);
    histFixed<<<(n + 255) / 256, 256>>>(d, n, hist);
    cudaMemcpy(got, hist, sizeof got, cudaMemcpyDeviceToHost);
    int bad = 0;
    for (int b = 0; b < BINS; b++)
        if (got[b] != ref[b]) bad++;
    printf("histFixed: %s (bin 0 = %u)\n", bad ? "MISMATCH" : "matches the CPU", got[0]);

    // the three shared reads of banks(): one warp
    float* o;
    cudaMalloc((void**)&o, 32 * sizeof(float));
    banks<<<1, 32>>>(o);
    float r[32];
    cudaMemcpy(r, o, sizeof r, cudaMemcpyDeviceToHost);
    printf("banks(): out[5] = %g (tile[5][0] + tile[5][5] + tile[2][1] = 160 + 165 + 65)\n", r[5]);
    printf("(%s) reverseCopy is not called: with an unsigned i, i >= 0 is always true\n",
           cudaGetErrorString(cudaGetLastError()));
    cudaFree(d);
    cudaFree(hist);
    cudaFree(o);
    delete[] h;
}
