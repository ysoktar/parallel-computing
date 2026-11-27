// Page 7.1, error checking. A kernel launch returns no error code; asynchronous errors show up only after a sync.
// 1) a configuration error (2048 threads per block) is caught right after the launch
// 2) cudaPeekAtLastError() reads the error without resetting it, cudaGetLastError() reads and resets it
// 3) an error DURING execution (writing through a null pointer) is caught by cudaDeviceSynchronize()
#include <cstdio>
#include <cstdlib>

// print the error with its file and line, and continue
#define CHECK(call) do {                                                                        \
        cudaError_t e = (call);                                                                 \
        if (e != cudaSuccess)                                                                   \
            printf("CUDA error \"%s\" at %s:%d\n", cudaGetErrorString(e), __FILE__, __LINE__);  \
    } while (0)

__global__ void k(float* a, int n) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i < n) a[i] = 2.0f * i;
}

int main() {
    const int n = 1024;
    float* d;
    CHECK(cudaMalloc((void**)&d, n * sizeof(float)));

    // --- 1) pre-launch (configuration) error
    cudaGetLastError();                        // clear earlier errors: the error variable must be cudaSuccess before the launch
    k<<<1, 2048>>>(d, n);                      // > 1024 threads per block: the launch fails
    cudaError_t launch = cudaPeekAtLastError();
    printf("1) after k<<<1, 2048>>>: Peek -> %s\n", cudaGetErrorString(launch));

    // --- 2) Peek does not reset, Get does
    printf("2) Peek again          -> %s (still there)\n", cudaGetErrorString(cudaPeekAtLastError()));
    printf("   Get                 -> %s (read and reset)\n", cudaGetErrorString(cudaGetLastError()));
    printf("   Get again           -> %s\n", cudaGetErrorString(cudaGetLastError()));

    // --- a correct launch, checked the recommended way
    cudaGetLastError();
    k<<<(n + 255) / 256, 256>>>(d, n);
    cudaError_t launchErr = cudaGetLastError();       // launch / configuration errors
    cudaError_t runErr = cudaDeviceSynchronize();     // errors during execution
    printf("   correct launch: launch -> %s, run -> %s\n", cudaGetErrorString(launchErr), cudaGetErrorString(runErr));

    // --- 3) an asynchronous error: the launch itself succeeds, the kernel fails while running
    k<<<(n + 255) / 256, 256>>>(nullptr, n);
    printf("3) launch with a null pointer: launch -> %s\n", cudaGetErrorString(cudaGetLastError()));
    printf("   cudaDeviceSynchronize()    -> %s\n", cudaGetErrorString(cudaDeviceSynchronize()));
    printf("   (an execution error like this is sticky: later calls in this process also fail)\n");
    cudaFree(d);
}
