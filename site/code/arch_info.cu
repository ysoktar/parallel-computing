// Page 6.1: which code runs on this GPU? Prints the GPU's compute capability and limits, and the __CUDA_ARCH__ value
// of the device code that was actually loaded. To build the slides' fat binary yourself (one command):
//   nvcc arch_info.cu -gencode arch=compute_50,code=sm_50
//                     -gencode arch=compute_60,code=sm_60
//                     -gencode arch=compute_70,code=\"compute_70,sm_70\"
// The last line also embeds compute_70 PTX, so newer GPUs can JIT-compile it.
#include <cstdio>

__global__ void whichArch() {
#ifdef __CUDA_ARCH__   // defined only while compiling device code, e.g. 700 for compute_70
    printf("device code compiled for __CUDA_ARCH__ = %d\n", __CUDA_ARCH__);
#endif
}

int main() {
    int n = 0;
    cudaGetDeviceCount(&n);
    for (int d = 0; d < n; d++) {
        cudaDeviceProp p;
        cudaGetDeviceProperties(&p, d);
        printf("GPU %d: %s, compute capability %d.%d, %d SMs, %zu KB shared/block, %d regs/block, warp %d\n",
               d, p.name, p.major, p.minor, p.multiProcessorCount, p.sharedMemPerBlock / 1024, p.regsPerBlock, p.warpSize);
        printf("  max threads/block %d, max threads/SM %d, global memory %.1f GB\n",
               p.maxThreadsPerBlock, p.maxThreadsPerMultiProcessor, p.totalGlobalMem / 1e9);
    }

    whichArch<<<1, 1>>>();
    cudaDeviceSynchronize();
    // "no kernel image is available" here means none of the compiled versions fits this GPU
    printf("(%s)\n", cudaGetErrorString(cudaGetLastError()));
}
