// Page 3.2: the C++11 monitor pattern: a mutex + unique_lock + condition_variable inside one class.
// Every method runs under the mutex; take() sleeps (releasing the lock) until count > 0.
#include <condition_variable>
#include <cstdio>
#include <mutex>
#include <thread>
#include <vector>

class Monitor {
    std::mutex m;
    std::condition_variable cv;
    int count = 0;

public:
    void put() {
        std::unique_lock<std::mutex> l(m);
        count++;
        cv.notify_one();                          // wake one waiting take()
    }
    void take() {
        std::unique_lock<std::mutex> l(m);
        cv.wait(l, [&] { return count > 0; });    // releases the lock while waiting, rechecks the condition on waking
        count--;
    }
    int value() {
        std::lock_guard<std::mutex> l(m);
        return count;
    }
};

int main() {
    Monitor mon;
    std::vector<std::thread> takers;
    for (int i = 0; i < 4; i++)
        takers.emplace_back([&] { for (int k = 0; k < 250; k++) mon.take(); });   // 4 × 250 = 1000 takes
    std::thread putter([&] { for (int k = 0; k < 1000; k++) mon.put(); });       // 1000 puts

    putter.join();
    for (auto& t : takers)
        t.join();
    printf("1000 puts, 1000 takes, count = %d (expected 0)\n", mon.value());
}
