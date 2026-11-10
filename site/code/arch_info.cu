// L6: which code runs on this GPU? Prints the device's compute capability, and __CUDA_ARCH__ as seen by the device
// code that was actually loaded. To build the slide's fat binary yourself:
//   nvcc x.cu -gencode arch=compute_50,code=sm_50
//             -gencode arch=compute_60,code=sm_60
//             -gencode arch=compute_70,code=\"compute_70,sm_70\"
#include <cstdio>

__global__ void whichArch() {
#ifdef __CUDA_ARCH__
    printf("device code compiled for __CUDA_ARCH__ = %d\n", __CUDA_ARCH__);
#endif
}

int main() {
    int n = 0; cudaGetDeviceCount(&n);
    for (int d = 0; d < n; d++) {
        cudaDeviceProp p; cudaGetDeviceProperties(&p, d);
        printf("GPU %d: %s, compute capability %d.%d, %d SMs, %zu KB shared/block, %d regs/block, warp %d\n",
               d, p.name, p.major, p.minor, p.multiProcessorCount, p.sharedMemPerBlock / 1024, p.regsPerBlock, p.warpSize);
        printf("  max threads/block %d, max threads/SM %d, global memory %.1f GB\n",
               p.maxThreadsPerBlock, p.maxThreadsPerMultiProcessor, p.totalGlobalMem / 1e9);
    }
    whichArch<<<1, 1>>>();
    cudaDeviceSynchronize();
    printf("(%s)\n", cudaGetErrorString(cudaGetLastError()));
}
