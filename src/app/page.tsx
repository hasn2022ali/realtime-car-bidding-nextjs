"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import ErrorMessage from "./components/Error";
import { FormatDate } from "./utils";
export default function Home() {
  interface AuctionStatus {
    auctionId: number;
    highestBid: number;
    highestBidder: number;
    user_id: number;
    username: string;
    timestamp: string;
  }

  interface AuctionItem {
    id: number;
    user_id: number;
    starting_price: number;
    start_date: string;
    end_date: string;
    highest_bid: string;
    highest_bidder: string;
    car_id?: string;
  }

  // const [socket, setSocket] = useState(null);
  const [auctionStatus, setAuctionStatus] = useState<AuctionStatus[]>([]);

  const [carId, setCarId] = useState("");
  const [userId, setUserId] = useState("");
  const [startingPrice, setStartingPrice] = useState("");
  const [auctionStart, setAuctionStart] = useState("");
  const [auctionEnd, setAuctionEnd] = useState("");
  const [activeCar, setActiveCar] = useState("");
  const [bidAmount, setBidAmount] = useState("");
  const [auctions, setAuctions] = useState([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState("");
  const [placeBidError, setPlaceBidError] = useState<string>("");
  const [loggedUserName, setLoggedUserName] = useState<string>("");

  const wsRef = useRef<WebSocket | null>(null);

  const connectWebSocket = useCallback(() => {
    wsRef.current = new WebSocket("ws://localhost:8080");

    wsRef.current.onopen = () => {
      console.log("Connected to WebSocket server");
      setIsConnected(true);
      // setSocket(ws);
      if (token && wsRef.current) {
        wsRef.current.send(JSON.stringify({ type: "AUTHENTICATE", token }));
      }
    };

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case "AUTHENTICATED":
          console.log("Authenticated with user");
          break;
        case "AUTH_ERROR":
          setError(data.message);
          handleLogout();
          break;
        case "SUBSCRIBED":
          console.log("Subscribed to auction:", data.auctionId);
          setActiveCar(data.auctionId);
          break;
        case "UNSUBSCRIBED":
          console.log("Unsubscribed from auction:", data.auctionId);
          setActiveCar("");
          break;
        case "AUCTION_STATUSES":
          console.log("Unsubscribed from auction:", data);
          setAuctionStatus(data.rows);
          break;

        case "ERROR":
          setError(data.message);
          break;
        case "PLACE_BID_ERROR":
          setPlaceBidError(data.message);
          break;
      }
      if (data.type === "AUCTION_STATUS") {
        setAuctionStatus((prevStatuses) => {
          const newStatus = {
            auctionId: data.carId,
            highestBid: data.highestBid,
            highestBidder: data.highestBidder,
            user_id: data.user_id,
            username: data.username,
            timestamp: new Date().toISOString(),
          };
          const updatedStatuses = [newStatus, ...prevStatuses];
          return updatedStatuses.slice(0, 20); // Keep only the latest 20 statuses
        });
      }
    };

    wsRef.current.onclose = () => {
      console.log("Disconnected from WebSocket server");
      setIsConnected(false);
      setTimeout(connectWebSocket, 5000);
    };

    wsRef.current.onerror = (error) => {
      console.error("WebSocket error:", error);
      if (wsRef.current) {
        wsRef.current.close();
      }
      setIsConnected(false);
    };
  }, [token]);
  // socket
  useEffect(() => {
    console.log("is logged in", isLoggedIn);
    const storedToken = localStorage.getItem("token");
    const storedLoggedUserName = localStorage.getItem("bid_username");
    if (storedToken && storedLoggedUserName) {
      // console.log("stored Token", storedToken);
      setToken(storedToken);
      setLoggedUserName(storedLoggedUserName);
      setIsLoggedIn(true);
      fetchAuctions(storedToken);
    }
    if (isLoggedIn) {
      connectWebSocket();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [isLoggedIn, connectWebSocket]);
  const placeBid = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.preventDefault();
    console.log("array", auctionStatus);

    const lastItem = auctionStatus.find(
      (a) => a.auctionId === Number(activeCar)
    );
    const currentHighestBid =
      lastItem && lastItem?.highestBid ? lastItem?.highestBid : 0;

    const newBidAmount = parseFloat(bidAmount);

    if (isNaN(newBidAmount) || newBidAmount <= currentHighestBid) {
      setPlaceBidError(
        `Please enter a bid higher than the current highest bid: $${currentHighestBid}`
      );
      return;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "PLACE_BID",
          auctionId: activeCar,
          amount: parseFloat(bidAmount),
          username: loggedUserName,
        })
      );
    } else {
      setPlaceBidError("WebSocket connection is not open");
    }
  };

  const subscribeToAuction = (auctionId: number) => {
    // setActiveCar(auctionId);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "SUBSCRIBE", auctionId }));
      wsRef.current.send(
        JSON.stringify({ type: "AUCTION_STATUSES_GET", auctionId })
      );
    }
  };

  const unsubscribeFromAuction = (auctionId: number) => {
    // setActiveCar("");
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "UNSUBSCRIBE", auctionId }));
    }
  };

  // const getAuctionStatus = () => {
  //   if (socket && carId) {
  //     socket.send(
  //       JSON.stringify({
  //         type: "GET_AUCTION_STATUS",
  //         carId,
  //       })
  //     );
  //   }
  // };
  // api's

  const fetchAuctions = async (authToken: string) => {
    try {
      const response = await fetch("http://localhost:3005/api/auctions", {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      const data = await response.json();
      console.log("response status: ", response.status);
      console.log(data);
      setAuctions(data.data);
    } catch (error) {
      console.error("Error fetching auctions: ", error);
    }
  };

  const createAuction = async (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    e.preventDefault();
    try {
      const response = await fetch("http://localhost:3005/api/auctions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          carId: carId,
          userId: userId,
          startingPrice: startingPrice,
          auctionStart: auctionStart,
          auctionEnd: auctionEnd,
        }),
      });
      if (response.ok) {
        console.log("Auction created successfully");
        setUserId("");
        setCarId("");
        setStartingPrice("");
        setAuctionStart("");
        setAuctionEnd("");
        fetchAuctions(token);
      } else {
        console.log("Failed to create auction");
      }
    } catch (error) {
      console.error("Error Creating Auction:", error);
    }
  };

  const handleLogin = async () => {
    try {
      const response = await fetch("http://localhost:3005/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });
      if (response.ok) {
        const data = await response.json();
        setToken(data.token);
        localStorage.setItem("token", data.token);
        localStorage.setItem("bid_username", username);
        setIsLoggedIn(true);
        setLoggedUserName(username);
        fetchAuctions(data.token);
      } else {
        console.error("Login failed");
      }
    } catch (error) {
      console.error("Error logging in:", error);
    }
  };

  const handleLogout = () => {
    setToken("");
    localStorage.removeItem("token");
    localStorage.removeItem("bid_username");
    setIsLoggedIn(false);
    setLoggedUserName("");
    setAuctions([]);
  };

  const handleRegister = async () => {
    try {
      const response = await fetch("http://localhost:3005/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });
      if (response.ok) {
        console.log("User registered successfully");
        handleLogin();
      } else {
        console.error("Registration failed");
      }
    } catch (error) {
      console.error("Error registering:", error);
    }
  };

  return (
    <div className="flex w-screen">
      <div className="sidebar w-60 p-10">
        <div className="optionsList pt-10 ">
          <h1 className="text-[24px]">{loggedUserName}</h1>
          <hr />
          <ul className="mt-4">
            <li>
              <a href="">Auctions</a>
            </li>
            <li className="mt-3">
              <a href="">BIDs</a>
            </li>
            {isLoggedIn ? (
              <li className="mt-4">
                <button
                  className="bg-transparent hover:bg-blue-500 text-white-700 font-semibold hover:text-white py-2 px-4 border border-white-500 hover:border-transparent rounded"
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </li>
            ) : (
              ""
            )}
          </ul>
        </div>
      </div>
      <div className="content w-full">
        {!isLoggedIn ? (
          <div className="mt-10 p-10 bg-white rounded shadow-xl max-w-96 text-black">
            <h2>Login or Register</h2>

            <div className="">
              <label className="block text-sm text-gray-600" htmlFor="name">
                Username
              </label>
              <input
                className="w-full px-5 py-1 text-gray-700 bg-gray-200 rounded"
                id="Username"
                name="Username"
                type="text"
                required={true}
                placeholder="Username"
                aria-label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="">
              <label className="block text-sm text-gray-600" htmlFor="name">
                Password
              </label>
              <input
                className="w-full px-5 py-1 text-gray-700 bg-gray-200 rounded"
                id="password"
                name="password"
                type="text"
                required={true}
                placeholder="Password"
                aria-label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="mt-4 flex gap-4">
              <button
                onClick={handleLogin}
                className="bg-transparent hover:bg-blue-500 text-blue-700 font-semibold hover:text-white py-2 px-4 border border-blue-500 hover:border-transparent rounded"
              >
                Login
              </button>
              <button
                onClick={handleRegister}
                className="bg-transparent hover:bg-blue-500 text-blue-700 font-semibold hover:text-white py-2 px-4 border border-blue-500 hover:border-transparent rounded"
              >
                Register
              </button>
            </div>
          </div>
        ) : (
          <div className="dashboardContainer">
            <div className="flex ">
              <div className="w-full lg:w-1/2 my-6 pr-0 lg:pr-2 ">
                <p>
                  Connection status:{" "}
                  {isConnected ? (
                    <span className="bg-green-100 text-green-800 text-xs font-medium me-2 px-2.5 py-0.5 rounded dark:bg-green-900 dark:text-green-300">
                      Connected
                    </span>
                  ) : (
                    <span className="bg-red-100 text-red-800 text-xs font-medium me-2 px-2.5 py-0.5 rounded dark:bg-red-900 dark:text-red-300">
                      Disconnected
                    </span>
                  )}
                </p>
                <p>
                  {error.length > 3 ? (
                    <span className="bg-red-100 text-red-800 text-xs font-medium me-2 px-2.5 py-0.5 rounded-full dark:bg-red-900 dark:text-red-300">
                      {error}
                    </span>
                  ) : (
                    ""
                  )}
                </p>

                <p className="text-xl pb-6 flex items-center">
                  <i className="fas fa-list mr-3"></i> Live Dashboard
                </p>
                <div className="p-10 bg-white rounded shadow-xl">
                  <div className="leading-loose">
                    <div className="">
                      <label
                        className="block text-sm text-gray-600"
                        htmlFor="name"
                      >
                        Auction ID
                      </label>
                      <div className="text-black ">
                        <h2>{activeCar}</h2>
                      </div>
                    </div>

                    <div className="">
                      <label
                        className="block text-sm text-gray-600"
                        htmlFor="name"
                      >
                        Highest BID
                      </label>
                    </div>
                    <div className="text-black max-h-[300px] overflow-y-auto pt-5">
                      {auctionStatus.map((item) => {
                        console.log("item from server:", item);
                        return (
                          <>
                            <div
                              key={item?.highestBid}
                              className="flex justify-between px-5"
                            >
                              <span>
                                User: {item?.user_id}, {item?.username}
                              </span>
                              <span>Auction: {item?.auctionId}</span>
                              <span>BID : {item?.highestBid}</span>
                            </div>
                            <hr />
                          </>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
              <div className="w-full lg:w-1/2 my-6 pr-0 lg:pr-2">
                <p className="text-xl pb-6 flex items-center">
                  <i className="fas fa-list mr-3"></i> Place New BID
                </p>
                <div className="leading-loose">
                  <form
                    className="p-10 bg-white rounded shadow-xl"
                    method="post"
                  >
                    <div className="">
                      <label
                        className="block text-sm text-gray-600"
                        htmlFor="name"
                      >
                        Auction ID
                      </label>
                      <input
                        className="w-full px-5 py-1 text-gray-700 bg-gray-200 rounded"
                        id="auctionId"
                        name="auctionID"
                        type="text"
                        value={activeCar}
                        disabled={true}
                        placeholder="Auction Id"
                        aria-label="Name"
                      />
                    </div>

                    <div className="">
                      <label
                        className="block text-sm text-gray-600"
                        htmlFor="name"
                      >
                        Amount
                      </label>
                      <input
                        className="w-full px-5 py-1 text-gray-700 bg-gray-200 rounded"
                        id="startingPrice"
                        name="startingPrice"
                        type="number"
                        required={true}
                        placeholder="Bid Amound"
                        aria-label="Name"
                        value={bidAmount}
                        onChange={(e) => setBidAmount(e.target.value)}
                      />
                    </div>
                    {placeBidError.length > 1 ? (
                      <ErrorMessage error={placeBidError} />
                    ) : (
                      ""
                    )}
                    <div className="mt-6">
                      <button
                        className="px-4 py-1 text-white font-light tracking-wider bg-gray-900 rounded"
                        type="submit"
                        onClick={placeBid}
                      >
                        Place BID
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              <div className="w-full lg:w-1/2 my-6 pr-0 lg:pr-2">
                <p className="text-xl pb-6 flex items-center">
                  <i className="fas fa-list mr-3"></i> Add New Auction
                </p>
                <div className="leading-loose">
                  <form
                    className="p-10 bg-white rounded shadow-xl"
                    method="post"
                  >
                    <div className="">
                      <label
                        className="block text-sm text-gray-600"
                        htmlFor="name"
                      >
                        Car ID
                      </label>
                      <input
                        className="w-full px-5 py-1 text-gray-700 bg-gray-200 rounded"
                        id="carId"
                        name="carId"
                        type="text"
                        value={carId}
                        required={true}
                        placeholder="Car Id"
                        aria-label="Name"
                        onChange={(e) => setCarId(e.target.value)}
                      />
                    </div>

                    <div className="">
                      <label
                        className="block text-sm text-gray-600"
                        htmlFor="name"
                      >
                        Starting Price
                      </label>
                      <input
                        className="w-full px-5 py-1 text-gray-700 bg-gray-200 rounded"
                        id="startingPrice"
                        name="startingPrice"
                        type="number"
                        required={true}
                        placeholder="Car Starting price"
                        aria-label="Name"
                        value={startingPrice}
                        onChange={(e) => setStartingPrice(e.target.value)}
                      />
                    </div>

                    <div className="">
                      <label
                        className="block text-sm text-gray-600"
                        htmlFor="name"
                      >
                        Auction Start
                      </label>
                      <input
                        className="w-full px-5 py-1 text-gray-700 bg-gray-200 rounded"
                        id="name"
                        name="auctionStart"
                        type="datetime-local"
                        required={true}
                        placeholder="Your Name"
                        aria-label="Name"
                        value={auctionStart}
                        onChange={(e) => setAuctionStart(e.target.value)}
                      />
                    </div>

                    <div className="">
                      <label
                        className="block text-sm text-gray-600"
                        htmlFor="name"
                      >
                        Auction End
                      </label>
                      <input
                        className="w-full px-5 py-1 text-gray-700 bg-gray-200 rounded"
                        id="name"
                        name="auctionEnd"
                        type="datetime-local"
                        required={true}
                        placeholder="Your Name"
                        aria-label="Name"
                        value={auctionEnd}
                        onChange={(e) => setAuctionEnd(e.target.value)}
                      />
                    </div>

                    <div className="mt-6">
                      <button
                        className="px-4 py-1 text-white font-light tracking-wider bg-gray-900 rounded"
                        type="submit"
                        onClick={createAuction}
                      >
                        ADD
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>

            <div className="list">
              <table className="min-w-full">
                <thead className="bg-gray-800">
                  <tr>
                    <th> ID</th>
                    <th>Car ID</th>
                    <th>User ID</th>
                    <th>Starting Price</th>
                    <th>starting</th>
                    <th>ending</th>
                    <th>Highest BID</th>
                    <th>highest bidder</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {auctions?.map((item: AuctionItem, index) => {
                    return (
                      <tr key={index} className="text-center">
                        <td>{item?.id}</td>
                        <td>{item?.car_id}</td>
                        <td>{item?.user_id}</td>
                        <td>{item?.starting_price}</td>
                        <td>{FormatDate(item?.start_date)}</td>
                        <td>{FormatDate(item?.end_date)}</td>
                        <td>
                          {auctionStatus[0]?.auctionId == item.id ? (
                            <span>
                              {auctionStatus.length <= 0
                                ? item?.highest_bid
                                : auctionStatus[0]?.highestBid}
                            </span>
                          ) : (
                            <span>{item?.highest_bid}</span>
                          )}
                        </td>
                        <td>
                          {auctionStatus[0]?.auctionId == item.id ? (
                            <span>
                              {auctionStatus.length <= 0
                                ? item?.highest_bidder
                                : auctionStatus[0]?.user_id}
                            </span>
                          ) : (
                            <span>{item?.highest_bidder}</span>
                          )}
                        </td>
                        {Number(activeCar) !== item?.id ? (
                          <td
                            className="cursor-pointer"
                            onClick={() => subscribeToAuction(item?.id)}
                          >
                            <span className="bg-yellow-100 text-yellow-800 text-xs font-medium me-2 px-2.5 py-0.5 rounded dark:bg-gray-700 dark:text-yellow-300 border border-yellow-300">
                              Subscribe
                            </span>
                          </td>
                        ) : (
                          <td
                            className="cursor-pointer"
                            onClick={() => unsubscribeFromAuction(item?.id)}
                          >
                            <span className="bg-green-100 text-green-800 text-xs font-medium me-2 px-2.5 py-0.5 rounded dark:bg-green-900 dark:text-green-300">
                              Watching
                            </span>

                            <span className="bg-red-100 text-red-800 text-xs font-medium me-2 px-2.5 py-0.5 rounded dark:bg-red-900 dark:text-red-300">
                              UnSubscribe
                            </span>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
