// Page 5.4, final-style exercise: multiply an n-element array by s with 256 threads per block. n need not be a multiple
// of 256, so the grid is rounded up and the extra threads are stopped by the bounds check.
#include <cstdio>
#include <cstdlib>

__global__ void scale(float* a, float s, int n) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i < n) a[i] *= s;              // the extra threads do nothing
}

// usage: prog [n]   (default 1000)
int main(int argc, char** argv) {
    int n = argc > 1 ? atoi(argv[1]) : 1000;
    float* h = new float[n];
    for (int i = 0; i < n; i++)
        h[i] = (float)i;

    // host:
    float* d;
    cudaMalloc((void**)&d, n * sizeof(float));
    cudaMemcpy(d, h, n * sizeof(float), cudaMemcpyHostToDevice);
    scale<<<(n + 255) / 256, 256>>>(d, 2.0f, n);
    cudaMemcpy(h, d, n * sizeof(float), cudaMemcpyDeviceToHost);
    cudaFree(d);

    int bad = 0;
    for (int i = 0; i < n; i++)
        if (h[i] != 2.0f * i) bad++;
    int blocks = (n + 255) / 256;
    printf("n = %d, %d blocks of 256 = %d threads; h[%d] = %g; %s\n",
           n, blocks, blocks * 256, n - 1, h[n - 1], bad ? "MISMATCH" : "all elements doubled");
    delete[] h;
}
