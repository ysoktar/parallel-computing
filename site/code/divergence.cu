// L4: thread divergence. In `divergent`, even and odd threads of the same warp take different branches, so the
// warp runs both branches one after the other; in `uniform` the condition is the same for a whole warp.
// Both compute the same kind of work; the timing shows the cost of divergence on this GPU.
#include <cstdio>
#include <cstdlib>

__global__ void divergent(float* a) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (threadIdx.x % 2 == 0)      // even and odd threads are in the SAME warp → both branches in turn
        a[i] = sinf(a[i]);
    else
        a[i] = cosf(a[i]);
}
__global__ void uniform(float* a) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if ((threadIdx.x / 32) % 2 == 0)  // the condition is the same for the whole warp → no divergence
        a[i] = sinf(a[i]);
    else
        a[i] = cosf(a[i]);
}

// usage: prog [millions of elements]   (default 16)
int main(int argc, char** argv) {
    const int n = (argc > 1 ? atoi(argv[1]) : 16) * (1 << 20), block = 256;
    float* a; cudaMalloc((void**)&a, n * sizeof(float));
    cudaMemset(a, 0, n * sizeof(float));
    cudaEvent_t t0, t1; cudaEventCreate(&t0); cudaEventCreate(&t1);
    for (int v = 0; v < 2; v++) {
        auto launch = [&] { if (v == 0) divergent<<<n / block, block>>>(a); else uniform<<<n / block, block>>>(a); };
        launch();                                   // warm-up
        cudaEventRecord(t0); for (int k = 0; k < 20; k++) launch(); cudaEventRecord(t1); cudaEventSynchronize(t1);
        float ms; cudaEventElapsedTime(&ms, t0, t1);
        printf("%-10s %.3f ms per launch\n", v == 0 ? "divergent" : "uniform", ms / 20);
    }
    printf("(%s) the difference shrinks if the branches are cheap or the kernel is memory-bound\n", cudaGetErrorString(cudaGetLastError()));
    cudaFree(a);
}
