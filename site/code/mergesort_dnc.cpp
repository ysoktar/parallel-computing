// L2: divide-and-conquer decomposition. The DnC pseudocode, made concrete as a top-down merge sort whose two
// halves run as separate tasks (std::async) down to a minimum size: the dependency graph, not the call graph.
#include <algorithm>
#include <cstdio>
#include <future>
#include <random>
#include <vector>

// DnC(A) {
//     if (A is a base case) return solution(A);
//     split A into N subproblems B[N];
//     for (int i = 0; i < N; i++) sol[i] = DnC(B[i]);
//     return mergeSolution(sol);
// }
void mergeLists(std::vector<int>& A, int st, int middle, int end) {
    std::inplace_merge(A.begin() + st, A.begin() + middle + 1, A.begin() + end + 1);
}

void mergeSort(std::vector<int>& A, int st, int end, int depth) {
    if (end > st) {                                // base case: one element
        int middle = (st + end) / 2;               // split into N = 2 subproblems
        if (depth > 0) {                           // solve the two halves concurrently
            auto left = std::async(std::launch::async, mergeSort, std::ref(A), st, middle, depth - 1);
            mergeSort(A, middle + 1, end, depth - 1);   // the parent solves one subproblem itself
            left.get();
        } else {
            mergeSort(A, st, middle, 0);
            mergeSort(A, middle + 1, end, 0);
        }
        mergeLists(A, st, middle, end);            // mergeSolution
    }
}

// usage: prog [n] [depth]   (default 1048576 numbers, depth 3 → up to 8 tasks)
#include <cstdlib>
int main(int argc, char** argv) {
    std::vector<int> A(argc > 1 ? atoi(argv[1]) : 1 << 20);
    int depth = argc > 2 ? atoi(argv[2]) : 3;
    std::mt19937 rng(1);
    for (int& x : A) x = rng() % 1000000;
    mergeSort(A, 0, (int)A.size() - 1, depth);     // up to 2^depth concurrent tasks
    printf("sorted %zu numbers: %s\n", A.size(), std::is_sorted(A.begin(), A.end()) ? "OK" : "WRONG");
    printf("first five: %d %d %d %d %d\n", A[0], A[1], A[2], A[3], A[4]);
}
