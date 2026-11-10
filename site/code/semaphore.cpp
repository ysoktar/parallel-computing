// L3: the logical semaphore implementation (acquire spins until count > 0 and decrements atomically;
// release increments), written with std::atomic compare-exchange, used to let at most 3 of 8 threads in at once.
#include <atomic>
#include <chrono>
#include <cstdio>
#include <thread>
#include <vector>

class Semaphore {
    std::atomic<int> count;
public:
    explicit Semaphore(int n) : count(n) {}
    void acquire() {
        while (1) {
            int c = count.load();
            if (c > 0 && count.compare_exchange_weak(c, c - 1)) return;   // atomic { if (count > 0) { count--; return; } }
            std::this_thread::yield();
        }
    }
    void release() { count++; }                                          // atomic { count++; }
};

Semaphore sem(3);
std::atomic<int> inside{0}, maxInside{0};

void worker(int id) {
    sem.acquire();
    int now = ++inside;
    int m = maxInside.load();
    while (now > m && !maxInside.compare_exchange_weak(m, now)) {}
    std::this_thread::sleep_for(std::chrono::milliseconds(50));          // use the "resource"
    --inside;
    sem.release();
}

int main() {
    std::vector<std::thread> ts;
    for (int i = 0; i < 8; i++) ts.emplace_back(worker, i);
    for (auto& t : ts) t.join();
    printf("at most %d threads were inside at the same time (semaphore count 3)\n", maxInside.load());
}
