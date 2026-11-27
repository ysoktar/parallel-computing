// Page 3.1: the semaphore of the slides, written with std::atomic. acquire() waits until count > 0 and decrements it in
// one indivisible step (compare-exchange); release() increments it. Used here to let at most 3 of 8 threads in at once.
#include <atomic>
#include <chrono>
#include <cstdio>
#include <thread>
#include <vector>

class Semaphore {
    std::atomic<int> count;

public:
    explicit Semaphore(int n) : count(n) {}

    void acquire() {   // slide: atomic { if (count > 0) { count--; return; } }, repeated until it succeeds
        while (true) {
            int c = count.load();
            if (c > 0 && count.compare_exchange_weak(c, c - 1)) return;   // count is still c → make it c - 1
            std::this_thread::yield();                                    // let another thread run, then retry
        }
    }

    void release() {   // slide: atomic { count++; }
        count++;
    }
};

Semaphore sem(3);
std::atomic<int> inside{0};      // how many threads are between acquire and release right now
std::atomic<int> maxInside{0};   // the largest value inside ever had

void worker(int id) {
    sem.acquire();
    int now = ++inside;
    int m = maxInside.load();
    while (now > m && !maxInside.compare_exchange_weak(m, now)) {}   // atomic "maxInside = max(maxInside, now)"
    std::this_thread::sleep_for(std::chrono::milliseconds(50));      // use the "resource"
    --inside;
    sem.release();
}

int main() {
    std::vector<std::thread> threads;
    for (int i = 0; i < 8; i++)
        threads.emplace_back(worker, i);
    for (auto& t : threads)
        t.join();
    printf("at most %d threads were inside at the same time (semaphore count 3)\n", maxInside.load());
}
