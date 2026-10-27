#include <boost/beast/core.hpp>
#include <boost/beast/http.hpp>
#include <boost/beast/version.hpp>
#include <boost/asio/dispatch.hpp>
#include <boost/asio/strand.hpp>
#include <boost/asio/ip/tcp.hpp>
#include <algorithm>
#include <chrono>
#include <cstdlib>
#include <iostream>
#include <memory>
#include <string>
#include <thread>
#include <vector>

namespace beast = boost::beast;
namespace http = beast::http;
namespace net = boost::asio;
using tcp = boost::asio::ip::tcp;

template <class Send>
void route_request(
    http::request<http::string_body>&& req,
    Send&& send)
{
    if (req.method() == http::verb::get)
    {
        if (req.target() == "/api/health")
        {
            http::response<http::string_body> res{http::status::ok, req.version()};
            res.set(http::field::server, "pulsync-backend");
            res.set(http::field::content_type, "application/json");
            res.set(http::field::access_control_allow_origin, "*");
            res.set(http::field::access_control_allow_methods, "GET, POST, OPTIONS");
            res.set(http::field::access_control_allow_headers, "Content-Type");
            res.keep_alive(req.keep_alive());
            res.body() = "{\"status\": \"ok\", \"service\": \"pulsync-backend\"}";
            res.prepare_payload();
            return send(std::move(res));
        }
    }
    else if (req.method() == http::verb::options)
    {
        http::response<http::empty_body> res{http::status::no_content, req.version()};
        res.set(http::field::server, "pulsync-backend");
        res.set(http::field::access_control_allow_origin, "*");
        res.set(http::field::access_control_allow_methods, "GET, POST, OPTIONS");
        res.set(http::field::access_control_allow_headers, "Content-Type");
        res.keep_alive(req.keep_alive());
        return send(std::move(res));
    }

    http::response<http::string_body> res{http::status::not_found, req.version()};
    res.set(http::field::server, "pulsync-backend");
    res.set(http::field::content_type, "application/json");
    res.keep_alive(req.keep_alive());
    res.body() = "{\"error\": \"Not Found\"}";
    res.prepare_payload();
    return send(std::move(res));
}

class session : public std::enable_shared_from_this<session>
{
    beast::tcp_stream stream_;
    beast::flat_buffer buffer_;
    http::request<http::string_body> req_;

public:
    explicit session(tcp::socket&& socket)
        : stream_(std::move(socket))
    {
    }

    void run()
    {
        net::dispatch(
            stream_.get_executor(),
            beast::bind_front_handler(
                &session::do_read,
                shared_from_this()));
    }

private:
    void do_read()
    {
        req_ = {};
        stream_.expires_after(std::chrono::seconds(30));

        http::async_read(
            stream_,
            buffer_,
            req_,
            beast::bind_front_handler(
                &session::on_read,
                shared_from_this()));
    }

    void on_read(beast::error_code ec, std::size_t bytes_transferred)
    {
        boost::ignore_unused(bytes_transferred);

        if (ec == http::error::end_of_stream)
        {
            return do_close();
        }

        if (ec)
        {
            return;
        }

        route_request(
            std::move(req_),
            [self = shared_from_this()](auto&& res)
            {
                using response_type = std::decay_t<decltype(res)>;
                auto sp = std::make_shared<response_type>(std::forward<decltype(res)>(res));

                http::async_write(
                    self->stream_,
                    *sp,
                    [self, sp](beast::error_code ec, std::size_t bytes_transferred)
                    {
                        self->on_write(ec, bytes_transferred, sp->need_eof());
                    });
            });
    }

    void on_write(beast::error_code ec, std::size_t bytes_transferred, bool close)
    {
        boost::ignore_unused(bytes_transferred);

        if (ec)
        {
            return;
        }

        if (close)
        {
            return do_close();
        }

        do_read();
    }

    void do_close()
    {
        beast::error_code ec;
        stream_.socket().shutdown(tcp::socket::shutdown_send, ec);
    }
};

class listener : public std::enable_shared_from_this<listener>
{
    net::io_context& ioc_;
    tcp::acceptor acceptor_;

public:
    listener(net::io_context& ioc, tcp::endpoint endpoint)
        : ioc_(ioc)
        , acceptor_(net::make_strand(ioc))
    {
        beast::error_code ec;

        acceptor_.open(endpoint.protocol(), ec);
        if (ec)
        {
            std::cerr << "Open error: " << ec.message() << std::endl;
            return;
        }

        acceptor_.set_option(net::socket_base::reuse_address(true), ec);
        if (ec)
        {
            std::cerr << "Set option error: " << ec.message() << std::endl;
            return;
        }

        acceptor_.bind(endpoint, ec);
        if (ec)
        {
            std::cerr << "Bind error: " << ec.message() << std::endl;
            return;
        }

        acceptor_.listen(net::socket_base::max_listen_connections, ec);
        if (ec)
        {
            std::cerr << "Listen error: " << ec.message() << std::endl;
            return;
        }
    }

    void run()
    {
        do_accept();
    }

private:
    void do_accept()
    {
        acceptor_.async_accept(
            net::make_strand(ioc_),
            beast::bind_front_handler(
                &listener::on_accept,
                shared_from_this()));
    }

    void on_accept(beast::error_code ec, tcp::socket socket)
    {
        if (ec)
        {
            std::cerr << "Accept error: " << ec.message() << std::endl;
        }
        else
        {
            std::make_shared<session>(std::move(socket))->run();
        }

        do_accept();
    }
};

int main(int argc, char* argv[])
{
    auto const address = net::ip::make_address("0.0.0.0");
    auto const port = static_cast<unsigned short>(8080);
    auto const threads = std::max<int>(1, std::thread::hardware_concurrency());

    net::io_context ioc{threads};

    std::make_shared<listener>(ioc, tcp::endpoint{address, port})->run();

    std::cout << "Pulsync Backend HTTP Server listening on " << address.to_string() << ":" << port << std::endl;

    std::vector<std::thread> v;
    v.reserve(threads - 1);
    for (auto i = threads - 1; i > 0; --i)
    {
        v.emplace_back([&ioc] { ioc.run(); });
    }
    ioc.run();

    for (auto& t : v)
    {
        t.join();
    }

    return 0;
}
