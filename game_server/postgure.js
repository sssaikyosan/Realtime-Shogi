import 'dotenv/config';
import { Pool } from 'pg';

export class Postgure {
    constructor() {
        this.pool = new Pool({
            user: process.env.POSTGURE_USER, // データベースユーザー名
            database: process.env.POSTGURE_DATABASE, // データベース名
            host: process.env.POSTGURE_HOST, // データベースホスト
            port: process.env.POSTGURE_PORT, // PostgreSQL のデフォルトポート
            password: process.env.POSTGURE_PASSWORD, // データベースパスワード
        });

        this.pool.on('error', (err, client) => {
            console.error('Unexpected error on idle client', err);
            process.exit(-1);
        });
    }

    /**
     * データベース接続を取得する
     * @returns {Promise<import('pg').PoolClient>} データベースクライアント
     */
    async connect() {
        return this.pool.connect();
    }

    /**
     * データをデータベースに保存する (例: プレイヤー統計)
     * @param {string} playerId - プレイヤーID
     * @param {object} data - 保存するデータ ({ total_games, rating, lastLogin, name })
     * @returns {Promise<void>}
     */
    async savePlayerInfo(data) {
        const client = await this.connect();
        try {
            const sql = `
                INSERT INTO playerinfo (player_id, total_games, rating, last_login, name)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT(player_id) DO UPDATE SET
                    total_games = EXCLUDED.total_games,
                    rating = EXCLUDED.rating,
                    last_login = EXCLUDED.last_login,
                    name = EXCLUDED.name
            `;
            const values = [data.player_id, data.total_games, data.rating, data.lastLogin, data.name];
            await client.query(sql, values);
            console.log(`Saved data for player`);
        } catch (err) {
            console.error(`Error saving data for player`, err);
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * データベースからデータを読み取る (例: プレイヤー統計)
     * @param {string} playerId - プレイヤーID
     * @returns {Promise<object|null>} 取得したデータ ({ player_id, total_games, rating, last_login, name })、または見つからない場合はnull
     */
    async readPlayerInfo(playerId) {
        const client = await this.connect();
        try {
            const sql = `
                SELECT player_id, total_games, rating, last_login, name
                FROM playerinfo
                WHERE player_id = $1
            `;
            const result = await client.query(sql, [playerId]);

            if (result.rows.length > 0) {
                const row = result.rows[0];
                return row;
            } else {
                console.log(`No data found for player`);
                return null; // プレイヤーが見つからない場合
            }
        } catch (err) {
            console.error(`Error reading data for player`, err);
            throw err;
        } finally {
            client.release();
        }
    }

    async getTopPlayers() {
        const client = await this.connect();
        try {
            // レーティングの高い順にトップ10を取得
            const sql = `
                SELECT rank, player_id, total_games, rating, last_login, name
                FROM topplayers
                `;
            const result = await client.query(sql);
            return result.rows;
        } catch (err) {
            console.error(`Error reading top players:`, err); // エラーメッセージを修正
            throw err;
        } finally {
            client.release();
        }
    }

    async readTopPlayers() {
        const client = await this.connect();
        try {
            // レーティングの高い順にトップ10を取得
            const sql = `
                SELECT rank, player_id, total_games, rating, last_login, name
                FROM topplayers
                `;
            const result = await client.query(sql);
            return result.rows;
        } catch (err) {
            console.error(`Error reading top players:`, err); // エラーメッセージを修正
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * トッププレイヤーリストをデータベースに保存する (既存データをクリアして新しいリストを挿入)
     * @param {object[]} topPlayersList - トッププレイヤーのリスト ({ player_id, total_games, rating, lastLogin, name }の配列)
     * @returns {Promise<void>}
     */
    async saveTopPlayers(topPlayersList) {
        const client = await this.connect();
        try {
            await client.query('BEGIN'); // トランザクション開始

            // 既存のトッププレイヤーデータを全て削除
            await client.query('DELETE FROM topplayers;');
            console.log('Cleared existing top players data.');

            // 新しいトッププレイヤーデータを挿入
            for (const player of topPlayersList) {
                const sql = `
                    INSERT INTO topplayers (rank, player_id, total_games, rating, last_login, name)
                    VALUES ($1, $2, $3, $4, $5, $6)
                `; // rankはSERIALなので指定しない
                const values = [player.rank, player.player_id, player.total_games, player.rating, player.lastLogin, player.name];
                await client.query(sql, values);
                console.log(`Inserted top player data for ${player.name}`);
            }

            await client.query('COMMIT'); // トランザクションコミット
            console.log(`Saved ${topPlayersList.length} top players.`);

        } catch (err) {
            await client.query('ROLLBACK'); // エラー時はロールバック
            console.error(`Error saving top players:`, err);
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * データベース接続プールを終了する
     * アプリケーション終了時に呼び出す
     * @returns {Promise<void>}
     */
    async end() {
        await this.pool.end();
        console.log('Database pool has ended');
    }
}