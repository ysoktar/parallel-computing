// Page 7.2: (1) #pragma unroll 5 with a trip count known only at run time: the compiler adds code for the leftover
// iterations, so the result is right even when n < 5 or n is not a multiple of 5. (2) signed vs unsigned loop counters.
#include <cstdio>
#include <cstdlib>

__global__ void sumUnrolled(const float* in, float* out, int n) {
    float s = 0;
    #pragma unroll 5
    for (int i = 0; i < n; ++i)
        s += in[i];
    *out = s;
}

// The same gather loop with an int and with an unsigned counter. Signed overflow is undefined, so the compiler may
// assume i never wraps and simplify offset + stride*i; with unsigned it must keep the wrap-around behaviour.
__global__ void gatherSigned(float* out, const float* in, int offset, int stride, int n) {
    for (int i = 0; i < n; i++) {
        out[i] = in[offset + stride*i];
    }
}
__global__ void gatherUnsigned(float* out, const float* in, unsigned offset, unsigned stride, unsigned n) {
    for (unsigned i = 0; i < n; i++) {
        out[i] = in[offset + stride*i];
    }
}

// usage: prog [n]   (default 3, try 3, 5, 12)
int main(int argc, char** argv) {
    int n = argc > 1 ? atoi(argv[1]) : 3;
    const int M = 1 << 22;
    float* h = new float[M];
    for (int i = 0; i < M; i++)
        h[i] = 1.0f;

    float *in, *out, *r;
    cudaMalloc((void**)&in, M * sizeof(float));
    cudaMalloc((void**)&out, M * sizeof(float));
    cudaMalloc((void**)&r, sizeof(float));
    cudaMemcpy(in, h, M * sizeof(float), cudaMemcpyHostToDevice);

    // (1) every element is 1, so the sum of n elements is n
    float s;
    sumUnrolled<<<1, 1>>>(in, r, n);
    cudaMemcpy(&s, r, sizeof(float), cudaMemcpyDeviceToHost);
    printf("#pragma unroll 5 with n = %d: sum = %g (expected %d)\n", n, s, n);

    // (2) time both counters (one thread, so the loop itself dominates)
    cudaEvent_t a, b;
    cudaEventCreate(&a);
    cudaEventCreate(&b);
    for (int v = 0; v < 2; v++) {
        auto launch = [&] {
            if (v == 0) gatherSigned<<<1, 1>>>(out, in, 1, 2, M / 4);
            else        gatherUnsigned<<<1, 1>>>(out, in, 1u, 2u, (unsigned)(M / 4));
        };
        launch();                                   // warm-up, not timed
        cudaEventRecord(a);
        launch();
        cudaEventRecord(b);
        cudaEventSynchronize(b);
        float ms;
        cudaEventElapsedTime(&ms, a, b);
        printf("%-8s loop counter: %.3f ms (one thread, %d iterations)\n", v == 0 ? "signed" : "unsigned", ms, M / 4);
    }
    printf("(%s) the difference depends on the GPU and compiler; see the SASS with cuobjdump -sass\n",
           cudaGetErrorString(cudaGetLastError()));
    cudaFree(in);
    cudaFree(out);
    cudaFree(r);
    delete[] h;
}
