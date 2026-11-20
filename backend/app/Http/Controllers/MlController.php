<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class MlController extends Controller
{
    private function mlUrl(): string
    {
        return rtrim(config('services.ml.url', env('ML_SERVICE_URL', 'http://127.0.0.1:8001')), '/');
    }

    private function proxyGet(string $path, array $query = []): JsonResponse
    {
        try {
            $response = Http::timeout(20)->get($this->mlUrl() . $path, $query);
            return response()->json($response->json(), $response->status());
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            return response()->json([
                'message' => 'Layanan analisis belum aktif.',
            ], 503);
        }
    }

    public function forecast(Request $request): JsonResponse
    {
        return $this->proxyGet('/forecast', $request->only('days'));
    }

    public function classification(): JsonResponse
    {
        return $this->proxyGet('/classification');
    }

    public function bundling(Request $request): JsonResponse
    {
        return $this->proxyGet('/bundling', $request->only('basis'));
    }

    public function evaluation(): JsonResponse
    {
        return $this->proxyGet('/evaluation');
    }
}
