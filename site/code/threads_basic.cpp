// L3: C++11 threads: fork 8 threads, each writes its own element, join them all.
#include <cstdio>
#include <thread>
#include <vector>

void work(int id, int* out) { out[id] = id * id; }

int main() {
    int out[8];
    std::vector<std::thread> ts;
    for (int i = 0; i < 8; i++) ts.emplace_back(work, i, out);   // fork
    for (auto& t : ts) t.join();                                  // join
    for (int i = 0; i < 8; i++) printf("out[%d] = %d\n", i, out[i]);
    printf("hardware threads on this machine: %u\n", std::thread::hardware_concurrency());
}
