// Midterm 2: __syncthreads() must be reached by ALL threads of the block. The right version puts only the load
// inside the if; the wrong version (barrier inside the if) is kept for reading but not launched: its behaviour is
// undefined (it may hang or give wrong results depending on the GPU).
#include <cstdio>

__global__ void wrong(const int* in, int* out) {
    __shared__ int s[16];
    if (threadIdx.x < 16) {
        s[threadIdx.x] = in[threadIdx.x];
        __syncthreads();   // tid ≥ 16 never gets here
    }
    out[threadIdx.x] = s[threadIdx.x % 16];
}

__global__ void right(const int* in, int* out) {
    __shared__ int s[16];
    if (threadIdx.x < 16)
        s[threadIdx.x] = in[threadIdx.x];
    __syncthreads();
    out[threadIdx.x] = s[threadIdx.x % 16];
}

int main() {
    int hin[16], hout[64];
    for (int i = 0; i < 16; i++) hin[i] = 100 + i;
    int *in, *out;
    cudaMalloc((void**)&in, sizeof hin); cudaMalloc((void**)&out, sizeof hout);
    cudaMemcpy(in, hin, sizeof hin, cudaMemcpyHostToDevice);
    right<<<1, 64>>>(in, out);
    cudaMemcpy(hout, out, sizeof hout, cudaMemcpyDeviceToHost);
    int bad = 0; for (int i = 0; i < 64; i++) if (hout[i] != 100 + i % 16) bad++;
    printf("right: out[0..3] = %d %d %d %d, out[60..63] = %d %d %d %d → %s\n",
           hout[0], hout[1], hout[2], hout[3], hout[60], hout[61], hout[62], hout[63], bad ? "WRONG" : "correct");
    printf("wrong: not launched (barrier inside a divergent if = undefined behaviour)\n");
    cudaFree(in); cudaFree(out);
}
