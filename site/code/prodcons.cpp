// Page 3.2, producer-consumer: two counting semaphores (slotsAvail counts free slots, resAvail counts filled ones) and
// a mutex (l) that protects the buffer indices. Termination: consumers know the total number of items (a shared count).
#include <condition_variable>
#include <cstdio>
#include <mutex>
#include <thread>
#include <vector>

// A counting semaphore built from a mutex + condition variable (std::counting_semaphore needs C++20).
class Semaphore {
    std::mutex m;
    std::condition_variable cv;
    int count;

public:
    explicit Semaphore(int n) : count(n) {}

    void acquire() {
        std::unique_lock<std::mutex> lk(m);
        cv.wait(lk, [&] { return count > 0; });   // sleep until a unit is available
        count--;
    }

    void release() {
        {
            std::lock_guard<std::mutex> lk(m);
            count++;
        }
        cv.notify_one();
    }
};

const int BUFFSIZE = 100;
int buffer[BUFFSIZE];
int in = 0, out = 0;                       // next slot to write / to read
Semaphore slotsAvail(BUFFSIZE), resAvail(0);
std::mutex l;
const int PRODUCERS = 2, CONSUMERS = 3, PER_PRODUCER = 1000;

void producer(int id) {
    for (int k = 0; k < PER_PRODUCER; k++) {
        int item = id * PER_PRODUCER + k;
        slotsAvail.acquire();              // wait for a free slot FIRST ...
        {
            std::lock_guard<std::mutex> g(l);   // ... then take the mutex (the other order can deadlock)
            buffer[in] = item;
            in = (in + 1) % BUFFSIZE;
        }
        resAvail.release();                // one more filled slot
    }
}

std::mutex sumLock;                        // protects total and consumed
long long total = 0;
int consumed = 0;

void consumer() {
    while (true) {
        {   // claim one item; stop when all items are claimed
            std::lock_guard<std::mutex> g(sumLock);
            if (consumed == PRODUCERS * PER_PRODUCER) return;
            consumed++;
        }
        resAvail.acquire();                // wait for a filled slot, then take the mutex
        int item;
        {
            std::lock_guard<std::mutex> g(l);
            item = buffer[out];
            out = (out + 1) % BUFFSIZE;
        }
        slotsAvail.release();              // one more free slot
        std::lock_guard<std::mutex> g(sumLock);
        total += item;
    }
}

int main() {
    std::vector<std::thread> threads;
    for (int i = 0; i < PRODUCERS; i++)
        threads.emplace_back(producer, i);
    for (int i = 0; i < CONSUMERS; i++)
        threads.emplace_back(consumer);
    for (auto& t : threads)
        t.join();

    long long n = PRODUCERS * PER_PRODUCER;   // items are 0 .. n-1, so their sum is n(n-1)/2
    printf("consumed %d items, sum %lld (expected %lld)\n", consumed, total, n * (n - 1) / 2);
}
