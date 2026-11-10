// L6 slide 40: 2D pitched allocation. cudaMallocPitch pads every row; the kernel finds row r at
// (char*)devPtr + r * pitch. cudaMemcpy2D copies between the unpadded host array and the padded device array.
#include <cstdio>

// Device code (as on the slide: every thread walks the array and reads it)
__global__ void MyKernel(float* devPtr, size_t pitch, int width, int height) {
    for (int r = 0; r < height; ++r) {
        float* row = (float*)((char*)devPtr + r * pitch);
        for (int c = 0; c < width; ++c) { float element = row[c]; }
    }
}

// a checking kernel: one thread per row doubles the row through the pitch
__global__ void doubleRows(float* devPtr, size_t pitch, int width, int height) {
    int r = blockIdx.x * blockDim.x + threadIdx.x;
    if (r < height) {
        float* row = (float*)((char*)devPtr + r * pitch);
        for (int c = 0; c < width; ++c) row[c] *= 2;
    }
}

int main() {
    // Host
    int width = 64, height = 64;
    float* devPtr; size_t pitch;
    cudaMallocPitch(&devPtr, &pitch, width * sizeof(float), height);
    MyKernel<<<100, 512>>>(devPtr, pitch, width, height);
    printf("width = %zu bytes → pitch = %zu bytes\n", width * sizeof(float), pitch);

    // copying with cudaMemcpy2D
    const int Ncols = width, Nrows = height;
    static float host[64 * 64];
    for (int i = 0; i < Ncols * Nrows; i++) host[i] = i;
    float* hostPtr = host;
    size_t devPitch = pitch, hostPitch = Ncols * sizeof(float);
    cudaMemcpy2D(devPtr, devPitch,            // destination and its pitch (GPU)
                 hostPtr, hostPitch,          // source and its pitch (CPU), usually Ncols*sizeof(float)
                 Ncols * sizeof(float), Nrows,// BYTES per row, number of rows
                 cudaMemcpyHostToDevice);
    doubleRows<<<1, 64>>>(devPtr, pitch, width, height);
    cudaMemcpy2D(hostPtr, hostPitch, devPtr, devPitch, Ncols * sizeof(float), Nrows, cudaMemcpyDeviceToHost);
    printf("host[0][1] = %g, host[63][63] = %g (doubled: 2, 8190)\n", host[1], host[63 * 64 + 63]);

    // the slide's pitch examples, on this GPU
    int widths[] = {5, 50, 250, 500, 700};
    for (int w : widths) {
        void* p; size_t pt; cudaMallocPitch(&p, &pt, w, 2);
        printf("  width %3d B → pitch %zu B\n", w, pt);
        cudaFree(p);
    }
    printf("(%s)\n", cudaGetErrorString(cudaGetLastError()));
    cudaFree(devPtr);
}
