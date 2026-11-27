// Page 3.2: an atomic<bool> used as a lock (a spin lock built on compare-and-swap) protecting a plain counter,
// next to a counter with no protection at all, to show the lost updates of a data race.
#include <atomic>
#include <cstdio>
#include <cstdlib>
#include <thread>
#include <vector>

std::atomic<bool> locked{false};

void lock() {
    bool expected = false;
    // CAS: if locked == false, set it to true and stop; otherwise someone holds the lock → try again
    while (!locked.compare_exchange_weak(expected, true))
        expected = false;   // a failed CAS writes the current value (true) into expected: reset it
}

void unlock() {
    locked.store(false);
}

long long counter = 0;          // not atomic: protected by the spin lock
long long racy = 0;             // no protection at all: a data race

// usage: prog [threads] [iterations]   (default 4 200000)
int main(int argc, char** argv) {
    int T = argc > 1 ? atoi(argv[1]) : 4;
    int I = argc > 2 ? atoi(argv[2]) : 200000;
    std::vector<std::thread> threads;
    for (int t = 0; t < T; t++)
        threads.emplace_back([I] {
            for (int i = 0; i < I; i++) {
                lock();
                counter++;
                unlock();
                racy++;
            }
        });
    for (auto& t : threads)
        t.join();

    printf("with the spin lock: %lld (expected %lld)\n", counter, (long long)T * I);
    printf("without any lock:   %lld (usually less: lost updates)\n", racy);
}
