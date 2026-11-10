// Loop unrolling: the tiled-matmul inner loop written three ways: plain, unrolled 4× by hand, and #pragma unroll.
// Same result; timing shows the effect on this GPU (often small: the compiler already unrolls constant loops).
#include <cstdio>
#include <vector>
#define TILE_WIDTH 16

template <int MODE>
__global__ void MatMul(const float* Md, const float* Nd, float* Pd, int width) {
    __shared__ float Mds[TILE_WIDTH][TILE_WIDTH], Nds[TILE_WIDTH][TILE_WIDTH];
    int tx = threadIdx.x, ty = threadIdx.y;
    int Row = blockIdx.y * TILE_WIDTH + ty, Col = blockIdx.x * TILE_WIDTH + tx;
    float sum = 0;
    for (int m = 0; m < width / TILE_WIDTH; ++m) {
        Mds[ty][tx] = Md[Row * width + m * TILE_WIDTH + tx];
        Nds[ty][tx] = Nd[(m * TILE_WIDTH + ty) * width + Col];
        __syncthreads();
        if (MODE == 0) {
            #pragma unroll 1                       // keep it a real loop (the "Normal" version)
            for (int k = 0; k < 16; ++k)
                sum += Mds[ty][k] * Nds[k][tx];
        } else if (MODE == 1) {
            #pragma unroll 1
            for (int k = 0; k < 16; k += 4) {      // unrolled 4 times by hand
                sum += Mds[ty][k]     * Nds[k][tx];
                sum += Mds[ty][k + 1] * Nds[k + 1][tx];
                sum += Mds[ty][k + 2] * Nds[k + 2][tx];
                sum += Mds[ty][k + 3] * Nds[k + 3][tx];
            }
        } else {
            #pragma unroll                         // fully unrolls if the trip count is known at compile time
            for (int k = 0; k < TILE_WIDTH; ++k)   // TILE_WIDTH is a #define / const → constant
                sum += Mds[ty][k] * Nds[k][tx];
        }
        __syncthreads();
    }
    Pd[Row * width + Col] = sum;
}

// usage: prog [width]   (a multiple of 16; default 1024)
#include <cstdlib>
__global__ void scaleRows(float* a, int n, float s) {   // the "#pragma unroll 4" and "#pragma unroll 1" examples
#pragma unroll 4               // unroll 4 times
for (int i = 0; i < n; ++i) a[i] *= s;

#pragma unroll 1               // do not unroll
for (int i = 0; i < n; ++i) a[i] += 1;
}

int main(int argc, char** argv) {
    const int W = argc > 1 ? atoi(argv[1]) / TILE_WIDTH * TILE_WIDTH : 1024, n = W * W;
    std::vector<float> M(n), N(n), P(n), ref;
    for (int i = 0; i < n; i++) { M[i] = (i % 3) * 0.5f; N[i] = (i % 4) * 0.25f; }
    float *Md, *Nd, *Pd;
    cudaMalloc((void**)&Md, n * 4); cudaMalloc((void**)&Nd, n * 4); cudaMalloc((void**)&Pd, n * 4);
    cudaMemcpy(Md, M.data(), n * 4, cudaMemcpyHostToDevice); cudaMemcpy(Nd, N.data(), n * 4, cudaMemcpyHostToDevice);
    dim3 block(TILE_WIDTH, TILE_WIDTH), grid(W / TILE_WIDTH, W / TILE_WIDTH);
    cudaEvent_t a, b; cudaEventCreate(&a); cudaEventCreate(&b);
    const char* names[] = {"plain loop", "unrolled 4x by hand", "#pragma unroll"};
    for (int v = 0; v < 3; v++) {
        auto launch = [&] {
            if (v == 0) MatMul<0><<<grid, block>>>(Md, Nd, Pd, W);
            else if (v == 1) MatMul<1><<<grid, block>>>(Md, Nd, Pd, W);
            else MatMul<2><<<grid, block>>>(Md, Nd, Pd, W);
        };
        launch(); cudaEventRecord(a); for (int k = 0; k < 10; k++) launch(); cudaEventRecord(b); cudaEventSynchronize(b);
        float ms; cudaEventElapsedTime(&ms, a, b); ms /= 10;
        cudaMemcpy(P.data(), Pd, n * 4, cudaMemcpyDeviceToHost);
        if (v == 0) ref = P;
        bool same = (P == ref);
        printf("%-22s %7.3f ms   %s\n", names[v], ms, same ? "same result" : "DIFFERENT result");
    }
    float hv[8] = {1, 2, 3, 4, 5, 6, 7, 8}, *dv; cudaMalloc((void**)&dv, sizeof hv);
    cudaMemcpy(dv, hv, sizeof hv, cudaMemcpyHostToDevice); scaleRows<<<1, 1>>>(dv, 8, 10.0f);
    cudaMemcpy(hv, dv, sizeof hv, cudaMemcpyDeviceToHost);
    printf("scaleRows: %g %g ... %g (each a[i]*10 + 1)\n", hv[0], hv[1], hv[7]);
    cudaFree(Md); cudaFree(Nd); cudaFree(Pd); cudaFree(dv);
}
