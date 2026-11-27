// Page 2.2, divide-and-conquer decomposition. The DnC pseudocode below, made concrete as a top-down merge sort whose
// two halves run as separate tasks (std::async) down to a chosen depth. What can run in parallel is read from the
// dependency graph (the two halves are independent; the merge waits for both), not from the call graph.
#include <algorithm>
#include <cstdio>
#include <cstdlib>
#include <future>
#include <random>
#include <vector>

// DnC(A) {
//     if (A is a base case) return solution(A);
//     split A into N subproblems B[N];
//     for (int i = 0; i < N; i++) sol[i] = DnC(B[i]);
//     return mergeSolution(sol);
// }

// merge the sorted ranges A[st..middle] and A[middle+1..end]
void mergeLists(std::vector<int>& A, int st, int middle, int end) {
    std::inplace_merge(A.begin() + st, A.begin() + middle + 1, A.begin() + end + 1);
}

void mergeSort(std::vector<int>& A, int st, int end, int depth) {
    if (end > st) {                                // base case: one element (nothing to do)
        int middle = (st + end) / 2;               // split into N = 2 subproblems
        if (depth > 0) {                           // solve the two halves concurrently
            auto left = std::async(std::launch::async, mergeSort, std::ref(A), st, middle, depth - 1);
            mergeSort(A, middle + 1, end, depth - 1);   // the parent solves one subproblem itself
            left.get();                                 // wait for the other half
        } else {                                   // deep enough: continue sequentially
            mergeSort(A, st, middle, 0);
            mergeSort(A, middle + 1, end, 0);
        }
        mergeLists(A, st, middle, end);            // mergeSolution
    }
}

// usage: prog [n] [depth]   (default 1048576 numbers, depth 3 → up to 2^3 = 8 tasks)
int main(int argc, char** argv) {
    std::vector<int> A(argc > 1 ? atoi(argv[1]) : 1 << 20);
    int depth = argc > 2 ? atoi(argv[2]) : 3;
    std::mt19937 rng(1);
    for (int& x : A)
        x = rng() % 1000000;

    mergeSort(A, 0, (int)A.size() - 1, depth);
    printf("sorted %zu numbers: %s\n", A.size(), std::is_sorted(A.begin(), A.end()) ? "OK" : "WRONG");
    printf("first numbers:");
    for (size_t i = 0; i < A.size() && i < 5; i++)
        printf(" %d", A[i]);
    printf("\n");
}
