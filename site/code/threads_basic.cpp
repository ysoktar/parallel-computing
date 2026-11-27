// Page 3.1: C++11 threads. Fork 8 threads, each writes its own element (no sharing, so no race), then join them all.
#include <cstdio>
#include <thread>
#include <vector>

void work(int id, int* out) {
    out[id] = id * id;   // every thread writes a different element
}

int main() {
    int out[8];
    std::vector<std::thread> threads;
    for (int i = 0; i < 8; i++)
        threads.emplace_back(work, i, out);   // fork: start a thread running work(i, out)
    for (auto& t : threads)
        t.join();                             // join: wait until it has finished

    for (int i = 0; i < 8; i++)
        printf("out[%d] = %d\n", i, out[i]);
    printf("hardware threads on this machine: %u\n", std::thread::hardware_concurrency());
}
