// Page 5.1: matrix multiplication on the CPU. One output element = one dot product = one loop (k); the two outer
// loops (i, j) are the ones that become threads on the GPU.
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <vector>

void MatrixMultiplication(float* M, float* N, float* P, int width) {
    for (int i = 0; i < width; ++i)
        for (int j = 0; j < width; ++j) {
            float sum = 0;
            for (int k = 0; k < width; ++k)
                sum += M[i*width + k] * N[k*width + j];
            P[i*width + j] = sum;
        }
}

// usage: prog [width]   (default 512)
int main(int argc, char** argv) {
    // small example: M = [1 2; 3 4], N = identity → P = M
    float M2[4] = {1, 2, 3, 4};
    float N2[4] = {1, 0, 0, 1};
    float P2[4];
    MatrixMultiplication(M2, N2, P2, 2);
    printf("P = [%g %g; %g %g]\n", P2[0], P2[1], P2[2], P2[3]);

    // timing on a W×W matrix (default 512×512)
    const int W = argc > 1 ? atoi(argv[1]) : 512;
    std::vector<float> M(W * W, 1.0f), N(W * W, 2.0f), P(W * W);
    auto t0 = std::chrono::high_resolution_clock::now();
    MatrixMultiplication(M.data(), N.data(), P.data(), W);
    auto t1 = std::chrono::high_resolution_clock::now();
    double ms = std::chrono::duration<double, std::milli>(t1 - t0).count();
    printf("%dx%d: P[0] = %g (expected %g), %.1f ms on one CPU core\n", W, W, P[0], 2.0f * W, ms);
}
