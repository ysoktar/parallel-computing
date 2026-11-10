// Midterm 2: the simplest shared-memory example: reverse each 256-element block of an array.
// Thread t reads s[B-1-t], which ANOTHER thread wrote → the __syncthreads() between is required.
#include <cstdio>
#define B 256

__global__ void reverseBlock(int* d)
{
    __shared__ int s[B];
    int t = threadIdx.x;
    int base = blockIdx.x * B;
    s[t] = d[base + t];          // 1) load
    __syncthreads();             // 2) has everyone loaded?
    d[base + t] = s[B - 1 - t];  // 3) read what ANOTHER
}                                //    thread loaded

// usage: prog [blocks]   (default 4, at least 2)
#include <cstdlib>
int main(int argc, char** argv) {
    int nb = argc > 1 ? atoi(argv[1]) : 4; if (nb < 2) nb = 2;
    const int n = nb * B; int* h = new int[n];
    for (int i = 0; i < n; i++) h[i] = i;
    int* d; cudaMalloc((void**)&d, n * sizeof(int)); cudaMemcpy(d, h, n * sizeof(int), cudaMemcpyHostToDevice);
    reverseBlock<<<n / B, B>>>(d);
    cudaMemcpy(h, d, n * sizeof(int), cudaMemcpyDeviceToHost);
    int bad = 0; for (int i = 0; i < n; i++) if (h[i] != (i / B) * B + (B - 1 - i % B)) bad++;
    printf("block 0 starts: %d %d %d ... ends: %d\n", h[0], h[1], h[2], h[B - 1]);
    printf("block 1 starts: %d %d %d ... ends: %d\n", h[B], h[B + 1], h[B + 2], h[2 * B - 1]);
    printf("%s\n", bad ? "MISMATCH" : "every block reversed correctly");
    cudaFree(d);
}
