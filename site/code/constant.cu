// L6: constant memory. Declared outside any function, filled from the host with cudaMemcpyToSymbol, read by all
// threads. Best case: all threads of a warp read the SAME address (one request, broadcast).
#include <cstdio>

__constant__ float constData[256];          // outside any function

__global__ void scale(float* out, int n) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i < n) out[i] = constData[0] * i + constData[i % 256];   // constData[0]: same address for everyone
}

int main() {
    float data[256];                             // host-side buffer
    for (int i = 0; i < 256; i++) data[i] = i == 0 ? 2.0f : 0.5f;
    cudaMemcpyToSymbol(constData, data, sizeof(data));   // copy before the kernel launch
    const int n = 1024; float h[n]; float* d; cudaMalloc((void**)&d, sizeof h);
    scale<<<n / 256, 256>>>(d, n);
    cudaMemcpy(h, d, sizeof h, cudaMemcpyDeviceToHost);
    printf("out[0] = %g, out[1] = %g, out[300] = %g (expected 2, 2.5, 600.5)\n", h[0], h[1], h[300]);
    cudaFree(d);
}
