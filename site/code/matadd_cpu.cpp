// Page 5.1: matrix addition on the CPU. Two nested loops over an N×N matrix stored row by row: element (i, j)
// is at index i*N + j. The CUDA kernel MatAdd replaces both loops with a 2D block of threads.
#include <cstdio>
#include <vector>

int main() {
    const int N = 4;
    std::vector<float> A(N * N), B(N * N), C(N * N);
    for (int k = 0; k < N * N; k++) {
        A[k] = k;
        B[k] = 100;
    }

    for (int i = 0; i < N; i++)          // row
        for (int j = 0; j < N; j++)      // column
            C[i*N + j] = A[i*N + j] + B[i*N + j];

    for (int i = 0; i < N; i++) {
        for (int j = 0; j < N; j++)
            printf("%6g", C[i*N + j]);
        printf("\n");
    }
}
