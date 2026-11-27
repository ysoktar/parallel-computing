// Page 5.1: vector addition on the CPU, the loop that the CUDA kernel VecAdd replaces.
#include <cstdio>
#include <vector>

int main() {
    const int N = 8;
    std::vector<float> A(N), B(N), C(N);
    for (int i = 0; i < N; i++) {
        A[i] = i;
        B[i] = 10 * i;
    }

    for (int i = 0; i < N; i++)   // on the GPU this loop disappears: thread i does iteration i
        C[i] = A[i] + B[i];

    for (int i = 0; i < N; i++)
        printf("C[%d] = %g\n", i, C[i]);
}
