// L6 (not on midterm 2): texRotate.cu from class without OpenCV: a synthetic 32×32 image (a white bar) is put in a
// CUDA array, read through a texture object with normalised coordinates, wrap addressing and bilinear filtering,
// and rotated by 0.5 rad. The result is printed as ASCII art.
#include <cstdio>

__global__ void transformKernel(float* output, cudaTextureObject_t texObj, int width, int height, float theta) {
    unsigned int x = blockIdx.x * blockDim.x + threadIdx.x;
    unsigned int y = blockIdx.y * blockDim.y + threadIdx.y;
    if (x < width && y < height) {
        float u = x / (float)width - 0.5f, v = y / (float)height - 0.5f;
        float tu = u * cosf(theta) - v * sinf(theta) + 0.5f;
        float tv = v * cosf(theta) + u * sinf(theta) + 0.5f;
        output[y * width + x] = tex2D<float>(texObj, tu, tv);
    }
}

int main() {
    const int width = 32, height = 32;
    float img[width * height];
    for (int y = 0; y < height; y++) for (int x = 0; x < width; x++) img[y * width + x] = (x >= 14 && x <= 17) ? 1.0f : 0.0f;

    // Host: 1) allocate CUDA array  2) copy data  3) resDesc  4) texDesc  5) create texture object
    cudaChannelFormatDesc ch = cudaCreateChannelDesc(32, 0, 0, 0, cudaChannelFormatKindFloat);
    cudaArray_t cuArray;
    cudaMallocArray(&cuArray, &ch, width, height);
    cudaMemcpy2DToArray(cuArray, 0, 0, img, width * sizeof(float), width * sizeof(float), height, cudaMemcpyHostToDevice);

    cudaResourceDesc resDesc = {};  resDesc.resType = cudaResourceTypeArray;  resDesc.res.array.array = cuArray;
    cudaTextureDesc texDesc = {};
    texDesc.addressMode[0] = cudaAddressModeWrap;   texDesc.addressMode[1] = cudaAddressModeWrap;
    texDesc.filterMode = cudaFilterModeLinear;      // bilinear interpolation for free
    texDesc.readMode = cudaReadModeElementType;
    texDesc.normalizedCoords = 1;                   // coordinates in [0, 1)
    cudaTextureObject_t texObj = 0;
    cudaCreateTextureObject(&texObj, &resDesc, &texDesc, NULL);

    float* output; cudaMalloc((void**)&output, sizeof img);
    dim3 block(16, 16); dim3 grid((width + 15) / 16, (height + 15) / 16);
    transformKernel<<<grid, block>>>(output, texObj, width, height, 0.5f);
    float out[width * height];
    cudaMemcpy(out, output, sizeof out, cudaMemcpyDeviceToHost);
    const char* shades = " .:-=+*#%@";
    for (int y = 0; y < height; y += 2) {
        for (int x = 0; x < width; x++) { int s = (int)(out[y * width + x] * 9.99f); putchar(shades[s < 0 ? 0 : s > 9 ? 9 : s]); }
        putchar('\n');
    }
    printf("(%s)\n", cudaGetErrorString(cudaGetLastError()));
    cudaDestroyTextureObject(texObj); cudaFreeArray(cuArray); cudaFree(output);
}
