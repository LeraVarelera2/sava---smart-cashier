<?php

namespace App\Http\Controllers;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class MlController extends Controller
{
    private function mlUrl(): string
    {
        return rtrim(config('services.ml.url'), '/');
    }

    private function proxyGet(string $path, array $query = []): JsonResponse
    {
        try {
            $response = Http::timeout(20)->get($this->mlUrl().$path, $query);
            if ($response->status() === 503) {
                return response()->json(['message' => 'Layanan analisis belum aktif.'], 503);
            }

            $payload = $response->json();
            if (! is_array($payload)) {
                return response()->json([
                    'message' => 'Respons layanan analisis tidak valid.',
                ], 502);
            }

            return response()->json($payload, $response->status());
        } catch (ConnectionException) {
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
