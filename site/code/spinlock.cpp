// L3: an atomic<bool> used as a lock (spin lock with compare-and-swap) protecting a plain counter.
#include <atomic>
#include <cstdio>
#include <thread>
#include <vector>

std::atomic<bool> locked{false};
void lock()   { bool exp = false; while (!locked.compare_exchange_weak(exp, true)) exp = false; }
void unlock() { locked.store(false); }

long long counter = 0;          // not atomic: protected by the spin lock
long long racy = 0;             // no protection at all: a data race

// usage: prog [threads] [iterations]   (default 4 200000)
#include <cstdlib>
int main(int argc, char** argv) {
    int T = argc > 1 ? atoi(argv[1]) : 4, I = argc > 2 ? atoi(argv[2]) : 200000;
    std::vector<std::thread> ts;
    for (int t = 0; t < T; t++)
        ts.emplace_back([I] {
            for (int i = 0; i < I; i++) {
                lock(); counter++; unlock();
                racy++;
            }
        });
    for (auto& t : ts) t.join();
    printf("with the spin lock: %lld (expected %lld)\n", counter, (long long)T * I);
    printf("without any lock:   %lld (usually less: lost updates)\n", racy);
}
