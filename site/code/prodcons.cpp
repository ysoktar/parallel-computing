// L3: producer-consumer with two counting semaphores (slotsAvail, resAvail) and a mutex (l) for the indices.
// Termination: every consumer knows the total number of items (a shared data item).
#include <condition_variable>
#include <cstdio>
#include <mutex>
#include <thread>
#include <vector>

class Semaphore {                                   // counting semaphore from a mutex + condition variable (C++17)
    std::mutex m; std::condition_variable cv; int count;
public:
    explicit Semaphore(int n) : count(n) {}
    void acquire() { std::unique_lock<std::mutex> lk(m); cv.wait(lk, [&] { return count > 0; }); count--; }
    void release() { { std::lock_guard<std::mutex> lk(m); count++; } cv.notify_one(); }
};

const int BUFFSIZE = 100;
int buffer[BUFFSIZE], in = 0, out = 0;
Semaphore slotsAvail(BUFFSIZE), resAvail(0);
std::mutex l;
const int PRODUCERS = 2, CONSUMERS = 3, PER_PRODUCER = 1000;

void producer(int id) {
    for (int k = 0; k < PER_PRODUCER; k++) {
        int item = id * PER_PRODUCER + k;
        slotsAvail.acquire();
        { std::lock_guard<std::mutex> g(l); buffer[in] = item; in = (in + 1) % BUFFSIZE; }
        resAvail.release();
    }
}

std::mutex sumLock; long long total = 0; int consumed = 0;

void consumer() {
    while (true) {
        { std::lock_guard<std::mutex> g(sumLock); if (consumed == PRODUCERS * PER_PRODUCER) return; consumed++; }
        resAvail.acquire();
        int item;
        { std::lock_guard<std::mutex> g(l); item = buffer[out]; out = (out + 1) % BUFFSIZE; }
        slotsAvail.release();
        std::lock_guard<std::mutex> g(sumLock); total += item;
    }
}

int main() {
    std::vector<std::thread> ts;
    for (int i = 0; i < PRODUCERS; i++) ts.emplace_back(producer, i);
    for (int i = 0; i < CONSUMERS; i++) ts.emplace_back(consumer);
    for (auto& t : ts) t.join();
    long long n = PRODUCERS * PER_PRODUCER;
    printf("consumed %d items, sum %lld (expected %lld)\n", consumed, total, n * (n - 1) / 2);
}
