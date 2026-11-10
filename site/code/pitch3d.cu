// L6 slide 41: 3D pitched allocation with cudaMalloc3D; slicePitch = pitch * height.
#include <cstdio>

// Device code (as on the slide: walks the whole volume and reads it)
__global__ void MyKernel(cudaPitchedPtr devPitchedPtr, int width, int height, int depth) {
    char* devPtr = (char*)devPitchedPtr.ptr;
    size_t pitch = devPitchedPtr.pitch;
    size_t slicePitch = pitch * height;
    for (int z = 0; z < depth; ++z) {
        char* slice = devPtr + z * slicePitch;
        for (int y = 0; y < height; ++y) {
            float* row = (float*)(slice + y * pitch);
            for (int x = 0; x < width; ++x) { float element = row[x]; }
        }
    }
}

// a checking kernel: element (x, y, z) = 100*z + y, one thread per (y, z) row
__global__ void fill(cudaPitchedPtr p, int width, int height, int depth) {
    int y = threadIdx.x, z = blockIdx.x;
    if (y < height && z < depth) {
        float* row = (float*)((char*)p.ptr + z * p.pitch * height + y * p.pitch);
        for (int x = 0; x < width; ++x) row[x] = 100.0f * z + y;
    }
}

int main() {
    int width = 64, height = 64, depth = 64;
    cudaExtent extent = make_cudaExtent(width * sizeof(float), height, depth);
    cudaPitchedPtr devPitchedPtr;
    cudaMalloc3D(&devPitchedPtr, extent);
    MyKernel<<<100, 512>>>(devPitchedPtr, width, height, depth);
    printf("row width %zu B → pitch %zu B, slice pitch %zu B\n", width * sizeof(float), devPitchedPtr.pitch, devPitchedPtr.pitch * height);
    fill<<<depth, height>>>(devPitchedPtr, width, height, depth);
    float v;   // read element (x=3, y=4, z=5) back: expect 504
    cudaMemcpy(&v, (char*)devPitchedPtr.ptr + 5 * devPitchedPtr.pitch * height + 4 * devPitchedPtr.pitch + 3 * sizeof(float), sizeof v, cudaMemcpyDeviceToHost);
    printf("element (3,4,5) = %g (expected 504); %s\n", v, cudaGetErrorString(cudaGetLastError()));
    cudaFree(devPitchedPtr.ptr);
}
