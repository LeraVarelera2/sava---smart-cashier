<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function setUpTraits(): array
    {
        if (
            config('database.default') !== 'pgsql'
            || config('database.connections.pgsql.database') !== 'sava_test'
        ) {
            throw new \RuntimeException('Tes API hanya boleh berjalan pada PostgreSQL database sava_test.');
        }

        return parent::setUpTraits();
    }
}
