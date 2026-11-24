// Quiz Q7: 3×3 Gaussian convolution (1/16)·[1 2 1; 2 4 2; 1 2 1] with zero padding; the filter is in constant memory
// (every thread of a warp reads the same coefficient at the same loop step → broadcast). Block size is a parameter.
#include <cstdio>
#include <cstdlib>

__constant__ float F[9]; // filled from the host with cudaMemcpyToSymbol
__global__ void conv(const float* in,float* out,int W,int H) {
    int x=blockIdx.x*blockDim.x+threadIdx.x;
    int y=blockIdx.y*blockDim.y+threadIdx.y;
    if(x>=W || y>=H) return;
    float sum=0;
    for(int dy=-1;dy<=1;dy++) {
        for(int dx=-1;dx<=1;dx++) {
            int xx=x+dx, yy=y+dy;
            if(xx>=0 && xx<W && yy>=0 && yy<H)
                sum+=in[yy*W+xx]*F[(dy+1)*3+dx+1];
        }
    }
    out[y*W+x]=sum;
}

// usage: prog [BX] [BY]   (block size, default 16 16)
int main(int argc, char** argv) {
    int BX = argc > 1 ? atoi(argv[1]) : 16, BY = argc > 2 ? atoi(argv[2]) : 16;
    const int W = 9, H = 7;
    float img[W*H], res[W*H];
    for (int i = 0; i < W*H; i++) img[i] = (i == 3*W + 4) ? 16.0f : 0.0f;   // one bright pixel in the middle
    float hF[] = {1/16.f, 2/16.f, 1/16.f, 2/16.f, 4/16.f, 2/16.f, 1/16.f, 2/16.f, 1/16.f};
    cudaMemcpyToSymbol(F,hF,9*sizeof(float));
    float *dIn, *dOut;
    cudaMalloc((void**)&dIn, sizeof img); cudaMalloc((void**)&dOut, sizeof img);
    cudaMemcpy(dIn, img, sizeof img, cudaMemcpyHostToDevice);
    dim3 b(BX,BY),g((W+BX-1)/BX,(H+BY-1)/BY);
    conv<<<g,b>>>(dIn,dOut,W,H);
    cudaMemcpy(res, dOut, sizeof res, cudaMemcpyDeviceToHost);
    printf("blur of a single 16 at (4,3), block %dx%d:\n", BX, BY);
    for (int y = 0; y < H; y++) { for (int x = 0; x < W; x++) printf("%4g", res[y*W+x]); printf("\n"); }
    printf("(%s)\n", cudaGetErrorString(cudaGetLastError()));
    cudaFree(dIn); cudaFree(dOut);
}
