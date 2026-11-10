// L5: matrix addition on the CPU: two nested loops, row-major index i*N + j.
#include <cstdio>
#include <vector>

int main() {
    const int N = 4;
    std::vector<float> A(N * N), B(N * N), C(N * N);
    for (int k = 0; k < N * N; k++) { A[k] = k; B[k] = 100; }

    for (int i = 0; i < N; i++)
        for (int j = 0; j < N; j++)
            C[i*N + j] = A[i*N + j] + B[i*N + j];

    for (int i = 0; i < N; i++) {
        for (int j = 0; j < N; j++) printf("%6g", C[i*N + j]);
        printf("\n");
    }
}
