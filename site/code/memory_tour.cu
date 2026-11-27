// Page 6.2: one kernel that touches every memory type. The comments say where each variable lives:
// constant (coef), global (total, in, out), shared (tile), registers (i, acc, left), local (hist, a run-time indexed array).
#include <cstdio>
#include <cstdlib>

__constant__ float coef[4];                     // CONSTANT: the whole grid sees it, only the host writes
__device__ float total;                         // GLOBAL: the whole grid + the host

__global__ void tour(const float* in, float* out, int n, int k)
{
    __shared__ float tile[256];                 // SHARED: the block's 256 threads see the same array
    int i = blockIdx.x * blockDim.x + threadIdx.x;   // REGISTER: every thread has its own i
    float acc = 0.0f;                           // REGISTER
    float hist[64];                             // may be LOCAL: large, indexed at run time (hist[k & 63] below)
    for (int j = 0; j < 64; j++) hist[j] = j;

    tile[threadIdx.x] = (i < n) ? in[i] : 0.0f; // GLOBAL read (consecutive i → coalesced) → SHARED write
    __syncthreads();                            // everyone must have written before shared memory is used
    float left = tile[(threadIdx.x + 255) % 256];    // SHARED read: a value another thread wrote
    acc = coef[0] * tile[threadIdx.x] + coef[1] * left + hist[k & 63];   // CONSTANT: same address for all → broadcast
    if (i < n) out[i] = acc;                    // GLOBAL write (coalesced)
    if (i == 0) total = acc;                    // GLOBAL
}

// usage: prog [k]   (default 5). Compile with --ptxas-options=-v to see the registers and the local memory ("lmem").
int main(int argc, char** argv) {
    int k = argc > 1 ? atoi(argv[1]) : 5;
    const int n = 1000;
    float h[n], r[n];
    for (int i = 0; i < n; i++)
        h[i] = (float)i;

    float hc[4] = {1.0f, 0.5f, 0.0f, 0.0f};
    cudaMemcpyToSymbol(coef, hc, sizeof hc);    // only the host writes constant memory

    float *in, *out;
    cudaMalloc((void**)&in, sizeof h);
    cudaMalloc((void**)&out, sizeof r);
    cudaMemcpy(in, h, sizeof h, cudaMemcpyHostToDevice);
    tour<<<(n + 255) / 256, 256>>>(in, out, n, k);
    cudaMemcpy(r, out, sizeof r, cudaMemcpyDeviceToHost);
    float t;
    cudaMemcpyFromSymbol(&t, total, sizeof t);  // read a __device__ variable back to the host

    printf("out[0] = %g (= 1*0 + 0.5*in[255 of block 0] + hist[k]: 0 + 127.5 + %d)\n", r[0], k & 63);
    printf("out[10] = %g (= 1*10 + 0.5*9 + %d), total = %g\n", r[10], k & 63, t);
    printf("(%s)\n", cudaGetErrorString(cudaGetLastError()));
    cudaFree(in);
    cudaFree(out);
}
