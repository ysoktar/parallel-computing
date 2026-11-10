// L6: the basic alignment requirement. Structs aligned with __align__(8) / __align__(16) are read with ONE
// 8 / 16-byte load per thread; a plain 12-byte struct is not a legal single load size.
#include <cstdio>

struct __align__(8)  Vec2 { float x; float y; };            // 8 bytes, 8-aligned → one 8 B load
struct __align__(16) Vec3 { float x; float y; float z; };   // 12 bytes of data, rounded up to 16 → one 16 B load
struct Plain12 { float x; float y; float z; };              // 12 bytes, 4-aligned → three 4 B loads

__global__ void sum16(const Vec3* v, float* out, int n) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i < n) out[i] = v[i].x + v[i].y + v[i].z;
}

int main() {
    printf("sizeof/alignof: Vec2 %zu/%zu, Vec3 %zu/%zu, Plain12 %zu/%zu\n",
           sizeof(Vec2), alignof(Vec2), sizeof(Vec3), alignof(Vec3), sizeof(Plain12), alignof(Plain12));
    const int n = 1024; Vec3 h[n]; float r[n];
    for (int i = 0; i < n; i++) h[i] = {1.0f * i, 2.0f, 3.0f};
    Vec3* d; float* o;
    cudaMalloc((void**)&d, sizeof h); cudaMalloc((void**)&o, sizeof r);
    printf("cudaMalloc address %% 256 = %zu (allocations are at least 256-byte aligned)\n", (size_t)d % 256);
    cudaMemcpy(d, h, sizeof h, cudaMemcpyHostToDevice);
    sum16<<<(n + 255) / 256, 256>>>(d, o, n);
    cudaMemcpy(r, o, sizeof r, cudaMemcpyDeviceToHost);
    printf("out[10] = %g (expected 15)\n", r[10]);
    cudaFree(d); cudaFree(o);
}
